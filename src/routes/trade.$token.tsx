import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/query-states";
import { allowedTransitions, lifecycleLabels, type LifecycleState } from "@/lib/lifecycle";
import { formatTarget } from "@/lib/findings/due-date";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";
import { absoluteUrl } from "@/lib/site-url";

/**
 * The subcontractor's front door. No account, one trade, one report.
 *
 * Everything shown here was filtered on the server: another trade's items and
 * any confidential finding never leave the database. The holder can report
 * progress and add a close-out photograph — they cannot amend the record.
 */
export const Route = createFileRoute("/trade/$token")({
  head: ({ params }) => {
    const title = "Your items for action — instructBrain";
    const description = "The items on a construction survey report assigned to your trade.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: absoluteUrl(`/trade/${params.token}`) },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: TradeList,
});

type Photo = { id: string; url: string | null };

type Item = {
  id: string;
  ref: string;
  severity: string | null;
  findingText: string | null;
  remedialText: string | null;
  captureFields: Record<string, string>;
  dueDate: string | null;
  lifecycleState: LifecycleState;
  lifecycleNote: string | null;
  lifecycleUpdatedAt: string | null;
  photos: Photo[];
  closeOutPhotos: Photo[];
};

type Payload = {
  trade: string;
  label: string | null;
  report: { id: string; title: string; reference: string | null; reportDate: string };
  snapshot: SurveyTypeSnapshot | null;
  projectName: string | null;
  projectAddress: string | null;
  organisationName: string | null;
  findings: Item[];
};

function problemFor(reason: string | null) {
  if (reason === "revoked") {
    return {
      heading: "Access to this list has been withdrawn",
      body: "Whoever sent you this link has withdrawn it. Contact them if you still need to report progress.",
    };
  }
  if (reason === "expired") {
    return {
      heading: "This link has expired",
      body: "Ask whoever sent it to you for a new one and it will open straight away.",
    };
  }
  if (reason === "unavailable") {
    return {
      heading: "This list cannot be opened at the moment",
      body: "Please try again shortly, or contact whoever sent you the link.",
    };
  }
  return {
    heading: "This link could not be opened",
    body: "The link may be incomplete or no longer in use. Check you copied all of it, or ask the sender for a new one.",
  };
}

function locationOf(fields: Record<string, string>): string {
  return fields["location"] ?? fields["zone"] ?? fields["area"] ?? fields["level"] ?? "";
}

function TradeList() {
  const { token } = Route.useParams();
  const client = useQueryClient();
  const queryKey = ["trade-access", token];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<Payload> => {
      const response = await fetch(`/api/public/trade-access/${token}`);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(body?.error ?? "This link could not be opened.") as Error & {
          reason?: string;
        };
        error.reason = body?.reason ?? null;
        throw error;
      }
      return body as Payload;
    },
    retry: false,
  });

  const move = useMutation({
    mutationFn: async (input: { findingId: string; to: LifecycleState }) => {
      const response = await fetch(`/api/public/trade-access/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "That could not be saved.");
      return body;
    },
    onSuccess: () => {
      toast.success("Progress recorded.");
      void client.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const upload = useMutation({
    mutationFn: async (input: { findingId: string; file: File }) => {
      const form = new FormData();
      form.set("findingId", input.findingId);
      form.set("file", input.file);
      const response = await fetch(`/api/public/trade-access/${token}`, {
        method: "PUT",
        body: form,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "That photograph could not be uploaded.");
      return body;
    },
    onSuccess: () => {
      toast.success("Photograph added.");
      void client.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reason = (query.error as (Error & { reason?: string }) | null)?.reason ?? null;
  const problem = problemFor(reason);
  const data = query.data;

  return (
    <div className="min-h-dvh bg-surface pb-28">
      <header className="border-b border-border bg-surface-raised">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <p className="editorial-title text-base font-semibold">instructBrain</p>
          {data ? (
            <>
              <h1 className="editorial-title mt-2 text-xl font-semibold">
                {data.label ?? data.trade} — items for action
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.projectName ?? "Project"}
                {data.report.reference ? ` · Ref ${data.report.reference}` : ""}
              </p>
            </>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {query.isPending ? (
          <LoadingState label="Opening your list…" />
        ) : query.isError ? (
          <div className="mx-auto max-w-xl rounded-xl border border-border bg-surface-raised p-6 text-center">
            <h1 className="editorial-title text-xl font-semibold">{problem.heading}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{problem.body}</p>
          </div>
        ) : data && data.findings.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-raised p-6 text-center">
            <h2 className="editorial-title text-lg font-semibold">Nothing outstanding</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              There are no items on this report assigned to {data.label ?? data.trade}.
            </p>
          </div>
        ) : data ? (
          <ul className="space-y-5">
            {data.findings.map((item) => (
              <li key={item.id}>
                <ItemCard
                  item={item}
                  snapshot={data.snapshot}
                  busy={move.isPending || upload.isPending}
                  onMove={(to) => move.mutate({ findingId: item.id, to })}
                  onPhoto={(file) => upload.mutate({ findingId: item.id, file })}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </main>

      {data && data.findings.length > 0 ? (
        <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-surface-raised/95 backdrop-blur">
          <p className="mx-auto max-w-3xl px-4 py-3 text-center text-xs text-muted-foreground sm:px-6">
            You are reporting progress only. The surveyor verifies and closes each item.
          </p>
        </footer>
      ) : null}
    </div>
  );
}

function ItemCard({
  item,
  snapshot,
  busy,
  onMove,
  onPhoto,
}: {
  item: Item;
  snapshot: SurveyTypeSnapshot | null;
  busy: boolean;
  onMove: (to: LifecycleState) => void;
  onPhoto: (file: File) => void;
}) {
  const [inputId] = useState(() => `closeout-${item.id}`);
  const options = allowedTransitions(item.lifecycleState, "subcontractor");
  const severityLabel =
    (snapshot?.severities ?? []).find((entry) => entry.id === item.severity)?.label ?? null;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface-raised">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <span className="eyebrow">{item.ref}</span>
        <span className="text-sm font-semibold">{severityLabel ?? "Severity not recorded"}</span>
        <span className="ml-auto text-sm text-muted-foreground">
          Target: {formatTarget(snapshot, item.severity, item.dueDate)}
        </span>
      </div>

      <div className="space-y-3 px-4 py-4">
        <p className="text-sm text-muted-foreground">
          {locationOf(item.captureFields) || "Location not recorded"}
        </p>

        {item.photos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto">
            {item.photos.map((photo) =>
              photo.url ? (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={`Photograph of item ${item.ref}`}
                  loading="lazy"
                  className="h-32 w-32 shrink-0 rounded-lg object-cover"
                />
              ) : null,
            )}
          </div>
        ) : null}

        <div>
          <h3 className="text-sm font-semibold">The issue</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
            {item.findingText || "Not recorded."}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Required action</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
            {item.remedialText || "Not recorded."}
          </p>
        </div>

        <p className="text-sm">
          <span className="text-muted-foreground">Status: </span>
          <span className="font-semibold">{lifecycleLabels[item.lifecycleState]}</span>
        </p>

        {item.closeOutPhotos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto">
            {item.closeOutPhotos.map((photo) =>
              photo.url ? (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={`Close-out photograph for item ${item.ref}`}
                  loading="lazy"
                  className="h-24 w-24 shrink-0 rounded-lg object-cover"
                />
              ) : null,
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-border bg-surface px-4 py-4">
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            variant={option === "fixed" ? "gloss" : "gloss-outline"}
            disabled={busy}
            className="min-h-[44px] w-full justify-center"
            onClick={() => onMove(option)}
          >
            {busy ? (
              <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
            ) : option === "fixed" ? (
              <Check aria-hidden="true" className="mr-2 size-4" />
            ) : (
              <PlayCircle aria-hidden="true" className="mr-2 size-4" />
            )}
            {option === "fixed" ? "Mark as fixed" : `Move to ${lifecycleLabels[option]}`}
          </Button>
        ))}

        <label
          htmlFor={inputId}
          className="flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-semibold"
        >
          <Camera aria-hidden="true" className="size-4" />
          Add a close-out photograph
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onPhoto(file);
          }}
        />
      </div>
    </article>
  );
}
