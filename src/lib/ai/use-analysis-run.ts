import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { analysePhoto, analysisState } from "@/lib/ai/analyse.functions";

/**
 * Client-side batch runner.
 *
 * One photograph is one server call, which is what makes a run cancellable and
 * resumable: cancelling stops new work starting and leaves every finding
 * already written intact. Results stream into the review list as each
 * photograph completes, so review can start before the batch finishes.
 */

/**
 * Photographs analysed at once. Raised from 4 to 12: speed comes from running
 * more work in parallel, never from sending the AI a smaller photograph
 * (invariant 3). The server still backs off on 429/5xx per request.
 */
export const RUN_CONCURRENCY = 12;

export type PhotoRunState = "pending" | "running" | "done" | "failed" | "skipped";

export type PhotoRun = {
  photoId: string;
  filename: string | null;
  sequence: number | null;
  analysed: boolean;
  state: PhotoRunState;
  message: string | null;
};

export type RunTotals = {
  completed: number;
  total: number;
  findings: number;
  notAssessed: number;
  failed: number;
  costUsd: number;
};

const EMPTY_TOTALS: RunTotals = {
  completed: 0,
  total: 0,
  findings: 0,
  notAssessed: 0,
  failed: 0,
  costUsd: 0,
};

export function useAnalysisRun(reportId: string) {
  const queryClient = useQueryClient();
  const loadState = useServerFn(analysisState);
  const runPhoto = useServerFn(analysePhoto);

  const [photos, setPhotos] = useState<PhotoRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [totals, setTotals] = useState<RunTotals>(EMPTY_TOTALS);

  const cancelled = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelled.current = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const states = await loadState({ data: { reportId } });
      if (!mounted.current) return;
      setPhotos(
        states.map((state) => ({
          ...state,
          state: state.analysed ? ("done" as const) : ("pending" as const),
          message: null,
        })),
      );
    } catch (error) {
      if (mounted.current) {
        setLoadError(error instanceof Error ? error.message : "The photographs could not be read.");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [loadState, reportId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const patch = useCallback((photoId: string, next: Partial<PhotoRun>) => {
    setPhotos((current) =>
      current.map((photo) => (photo.photoId === photoId ? { ...photo, ...next } : photo)),
    );
  }, []);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["findings", reportId] });
    await queryClient.invalidateQueries({ queryKey: ["report", reportId] });
    await queryClient.invalidateQueries({ queryKey: ["ai-usage"] });
  }, [queryClient, reportId]);

  // A 150-photograph run must not fire 150 refetches. Results still stream in,
  // at most about twice a second, and the run always ends with a final flush.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleInvalidate = useCallback(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      if (mounted.current) void invalidate();
    }, 500);
  }, [invalidate]);
  const flushInvalidate = useCallback(async () => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
    await invalidate();
  }, [invalidate]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  const execute = useCallback(
    async (queue: PhotoRun[], force: boolean, fast = false) => {
      if (queue.length === 0) return;
      cancelled.current = false;
      setRunning(true);
      setFatalError(null);
      setTotals({ ...EMPTY_TOTALS, total: queue.length });

      let cursor = 0;
      const workers = Array.from(
        { length: Math.min(RUN_CONCURRENCY, queue.length) },
        async () => {
          while (cursor < queue.length) {
            if (cancelled.current) return;
            const item = queue[cursor];
            cursor += 1;
            if (!item) return;

            patch(item.photoId, { state: "running", message: null });
            try {
              const result = await runPhoto({
                data: { reportId, photoId: item.photoId, force, fast },
              });
              if (!mounted.current) return;
              // A run that still recorded observations is not a failure: the
              // items exist and any problem is carried as Not assessed.
              const lost = Boolean(result.error) && result.findingsCreated === 0;
              patch(item.photoId, {
                state: lost ? "failed" : "done",
                analysed: true,
                message: lost
                  ? "Not assessed — this photograph could not be saved. Try again."
                  : `${result.findingsCreated} draft${result.findingsCreated === 1 ? "" : "s"}${result.cached ? " · from cache" : ""}${result.notAssessed > 0 ? ` · ${result.notAssessed} not assessed` : ""}`,
              });
              setTotals((current) => ({
                ...current,
                completed: current.completed + 1,
                findings: current.findings + result.findingsCreated,
                notAssessed: current.notAssessed + result.notAssessed,
                failed: current.failed + (lost ? 1 : 0),
                costUsd: current.costUsd + result.costUsd,
              }));

              // Results stream into the review list as they complete, batched
              // so a large run does not refetch once per photograph.
              scheduleInvalidate();
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "This photograph could not be assessed.";
              if (!mounted.current) return;
              patch(item.photoId, { state: "failed", message });
              setTotals((current) => ({
                ...current,
                completed: current.completed + 1,
                failed: current.failed + 1,
              }));
              // A budget or configuration refusal stops the whole run, loudly.
              if (/monthly AI cap|No AI provider key/i.test(message)) {
                cancelled.current = true;
                setFatalError(message);
              }
            }
          }
        },
      );

      await Promise.all(workers);
      if (!mounted.current) return;
      setRunning(false);
      setPhotos((current) =>
        current.map((photo) =>
          photo.state === "running" || (photo.state === "pending" && cancelled.current)
            ? { ...photo, state: photo.analysed ? "done" : "skipped" }
            : photo,
        ),
      );
      await flushInvalidate();
    },
    [flushInvalidate, scheduleInvalidate, patch, reportId, runPhoto],
  );

  const analyseAll = useCallback(
    async (fast = false) => {
      const queue = photos.filter((photo) => !photo.analysed);
      await execute(queue, false, fast);
    },
    [execute, photos],
  );

  const reanalyse = useCallback(
    async (photoId: string, fast = false) => {
      const photo = photos.find((entry) => entry.photoId === photoId);
      if (!photo) return;
      await execute([photo], true, fast);
    },
    [execute, photos],
  );


  const cancel = useCallback(() => {
    cancelled.current = true;
  }, []);

  return {
    photos,
    loading,
    loadError,
    running,
    fatalError,
    totals,
    pendingCount: photos.filter((photo) => !photo.analysed).length,
    analyseAll,
    reanalyse,
    cancel,
    refresh,
  };
}
