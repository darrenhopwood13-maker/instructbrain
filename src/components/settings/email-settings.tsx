import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  emailConfigurationStatus,
  emailFailures,
  retrySend,
  sendTestEmail,
} from "@/lib/email/email.functions";

/**
 * Admin-only email status. It reports what is actually true — whether a key is
 * present, what address messages come from, and which sends failed with the
 * provider's own error. The key itself is never displayed.
 */
export function EmailSettingsPanel({
  organisationId,
  organisationName,
}: {
  organisationId: string | null;
  organisationName: string;
}) {
  const queryClient = useQueryClient();
  const status = useServerFn(emailConfigurationStatus);
  const failures = useServerFn(emailFailures);
  const test = useServerFn(sendTestEmail);
  const retry = useServerFn(retrySend);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["email-status"],
    queryFn: () => status(undefined as never),
  });

  const failuresQuery = useQuery({
    queryKey: ["email-failures", organisationId],
    enabled: !!organisationId,
    queryFn: () => failures({ data: { organisationId: organisationId as string } }),
  });

  const testMutation = useMutation({
    mutationFn: () => test({ data: { organisationName } }),
    onSuccess: (result) => {
      setLastResult(
        `Accepted by Resend${result.providerMessageId ? ` (message ${result.providerMessageId})` : ""}. Check your inbox.`,
      );
      toast.success("Test email accepted by the provider");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unknown error.";
      setLastResult(message);
      toast.error("The test email was not sent", { description: message });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (distributionId: string) => retry({ data: { distributionId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["email-failures", organisationId] });
      toast.success("Re-sent");
    },
    onError: (error) =>
      toast.error("The retry failed", {
        description: error instanceof Error ? error.message : "Unknown error.",
      }),
  });

  const configured = statusQuery.data?.configured ?? false;
  const failureRows = failuresQuery.data ?? [];

  return (
    <section
      aria-labelledby="email-settings-heading"
      className="mt-6 max-w-2xl rounded-xl border border-border bg-surface-raised p-4 sm:p-5"
    >
      <h2 id="email-settings-heading" className="text-sm font-semibold">
        Email delivery
      </h2>

      {statusQuery.isPending ? (
        <p className="mt-2 text-sm text-muted-foreground">Checking your email configuration…</p>
      ) : (
        <>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-muted-foreground">Provider key</dt>
              <dd className="flex items-center gap-1.5 font-medium">
                {configured ? (
                  <>
                    <CheckCircle2 aria-hidden="true" className="size-4 text-pass" />
                    Configured
                  </>
                ) : (
                  <>
                    <XCircle aria-hidden="true" className="size-4 text-fail" />
                    Not configured
                  </>
                )}
              </dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-muted-foreground">Sends from</dt>
              <dd className="break-all font-mono text-xs">{statusQuery.data?.fromAddress}</dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-muted-foreground">Replies to</dt>
              <dd className="break-all font-mono text-xs">{statusQuery.data?.replyToAddress}</dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-muted-foreground">Delivery webhooks</dt>
              <dd className="font-medium">
                {statusQuery.data?.webhookConfigured
                  ? "Configured"
                  : "Not configured — bounces will not be recorded"}
              </dd>
            </div>
          </dl>

          {!configured ? (
            <div role="alert" className="mt-4 rounded-lg border border-fail/40 bg-fail-soft p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-fail">
                <AlertTriangle aria-hidden="true" className="size-4" />
                No email can be sent
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Add <span className="font-mono text-xs">RESEND_API_KEY</span> in Project Settings →
                Secrets, using a key from a Resend account with{" "}
                <span className="font-mono text-xs">{statusQuery.data?.senderDomain}</span> verified
                (SPF, DKIM and DMARC). Until then every send fails visibly rather than pretending to
                have worked.
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="quiet"
              size="sm"
              disabled={testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              {testMutation.isPending ? (
                <Loader2 aria-hidden="true" className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Send aria-hidden="true" className="mr-1.5 size-4" />
              )}
              Send a test email to me
            </Button>
          </div>
          {lastResult ? (
            <p role="status" className="mt-2 break-words text-sm text-muted-foreground">
              {lastResult}
            </p>
          ) : null}

          {failureRows.length > 0 ? (
            <div className="mt-5 rounded-lg border border-fail/40 bg-fail-soft p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-fail">
                <AlertTriangle aria-hidden="true" className="size-4" />
                {failureRows.length} recent send{failureRows.length === 1 ? "" : "s"} did not arrive
              </p>
              <ul className="mt-2 space-y-2">
                {failureRows.map((failure) => (
                  <li
                    key={failure.id}
                    className="rounded-md border border-border bg-surface-raised p-2 text-sm"
                  >
                    <p className="font-medium break-all">
                      {failure.recipient}
                      {failure.trade ? ` — ${failure.trade}` : ""}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {failure.status === "bounced" ? "Bounced" : "Failed"} ·{" "}
                      {new Date(failure.createdAt).toLocaleString("en-GB")}
                    </p>
                    {failure.error ? (
                      <p className="mt-1 break-words text-xs text-muted-foreground">
                        {failure.error}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      variant="quiet"
                      size="sm"
                      className="mt-2"
                      disabled={retryMutation.isPending}
                      onClick={() => retryMutation.mutate(failure.id)}
                    >
                      <RefreshCw aria-hidden="true" className="mr-1.5 size-4" />
                      Retry this send
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      <div className="mt-5 rounded-lg border border-warn/40 bg-warn-soft p-3">
        <p className="text-sm font-semibold">Sign-in emails are configured separately</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Magic links, password resets and sign-up confirmations are sent by Supabase, not by the
          key above. Until custom SMTP is enabled in the Supabase dashboard under Authentication →
          Emails → SMTP Settings, those messages are heavily rate limited and unreliable, and people
          will be locked out of their own accounts. Use{" "}
          <span className="font-mono text-xs">smtp.resend.com</span>, port{" "}
          <span className="font-mono text-xs">465</span>, username{" "}
          <span className="font-mono text-xs">resend</span>, password: a Resend API key, and a
          sender on your verified domain. Raise the auth email rate limit once it is active.
        </p>
      </div>
    </section>
  );
}
