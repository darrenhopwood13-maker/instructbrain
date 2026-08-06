/**
 * Bounded-concurrency upload queue with retry and resume.
 *
 * Pure and framework-free so it can be unit tested. Yields to the event loop
 * between tasks so a 200+ photo session never locks the tab.
 */

export type TaskState = "queued" | "running" | "done" | "error" | "cancelled";

export type TaskProgress = {
  id: string;
  state: TaskState;
  /** 0–1 for this task. */
  progress: number;
  attempts: number;
  error?: string;
};

export type QueueOptions = {
  concurrency?: number;
  maxAttempts?: number;
  /** Base backoff in ms; grows exponentially per attempt. */
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onProgress?: (snapshot: TaskProgress[]) => void;
  signal?: { aborted: boolean };
};

export type Task<T> = {
  id: string;
  run: (report: (fraction: number) => void, attempt: number) => Promise<T>;
  /** Return true when the work is already persisted — resume, do not redo. */
  isComplete?: () => Promise<boolean> | boolean;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type QueueResult<T> = {
  id: string;
  value?: T;
  error?: Error;
  state: TaskState;
};

export async function runUploadQueue<T>(
  tasks: Array<Task<T>>,
  options: QueueOptions = {},
): Promise<Array<QueueResult<T>>> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 6));
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const backoffMs = options.backoffMs ?? 400;
  const sleep = options.sleep ?? defaultSleep;

  const progress: TaskProgress[] = tasks.map((task) => ({
    id: task.id,
    state: "queued",
    progress: 0,
    attempts: 0,
  }));
  const results: Array<QueueResult<T>> = tasks.map((task) => ({ id: task.id, state: "queued" }));

  const emit = () => options.onProgress?.(progress.map((item) => ({ ...item })));
  emit();

  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const task = tasks[index];
      if (!task) return;
      const entry = progress[index]!;

      if (options.signal?.aborted) {
        entry.state = "cancelled";
        results[index] = { id: task.id, state: "cancelled" };
        emit();
        continue;
      }

      // Resume: work already persisted is never repeated.
      try {
        if (task.isComplete && (await task.isComplete())) {
          entry.state = "done";
          entry.progress = 1;
          results[index] = { id: task.id, state: "done" };
          emit();
          continue;
        }
      } catch {
        // A failed completeness probe just means we try the upload.
      }

      entry.state = "running";
      emit();

      let lastError: Error | undefined;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (options.signal?.aborted) break;
        entry.attempts = attempt;
        try {
          const value = await task.run((fraction) => {
            entry.progress = Math.max(0, Math.min(1, fraction));
            emit();
          }, attempt);
          entry.state = "done";
          entry.progress = 1;
          delete entry.error;
          results[index] = { id: task.id, state: "done", value };
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          entry.error = lastError.message;
          if (attempt < maxAttempts) {
            entry.state = "queued";
            emit();
            await sleep(backoffMs * 2 ** (attempt - 1));
          }
        }
      }

      if (lastError) {
        entry.state = options.signal?.aborted ? "cancelled" : "error";
        results[index] = {
          id: task.id,
          state: entry.state,
          error: lastError,
        };
      }
      emit();
      // Yield so the UI thread stays responsive across a large batch.
      await sleep(0);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

export function overallProgress(snapshot: TaskProgress[]): number {
  if (snapshot.length === 0) return 0;
  const total = snapshot.reduce((sum, item) => sum + item.progress, 0);
  return total / snapshot.length;
}
