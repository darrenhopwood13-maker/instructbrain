/**
 * The Resend transport. Server-only: the key never reaches the browser.
 *
 * Failure is always visible. A missing key throws, a provider rejection throws
 * with the provider's own error text, and a 429 is backed off and retried
 * rather than dropped.
 */
import {
  EmailProviderError,
  FROM_ADDRESS,
  REPLY_TO_ADDRESS,
  RESEND_BASE_BACKOFF_MS,
  RESEND_MAX_ATTEMPTS,
  resolveResendKey,
} from "./config";
import type { EmailAttachment, RenderedEmail } from "./templates";

const RESEND_URL = "https://api.resend.com/emails";

export type SendResult = { providerMessageId: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendRenderedEmail(
  to: string,
  rendered: RenderedEmail,
  options: { tags?: Array<{ name: string; value: string }> } = {},
): Promise<SendResult> {
  const key = resolveResendKey(process.env["RESEND_API_KEY"]);

  const body: Record<string, unknown> = {
    from: FROM_ADDRESS,
    reply_to: REPLY_TO_ADDRESS,
    to: [to],
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  };
  if (rendered.attachments.length > 0) {
    body["attachments"] = rendered.attachments.map((attachment: EmailAttachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      content_type: attachment.contentType ?? "application/pdf",
    }));
  }
  if (options.tags && options.tags.length > 0) body["tags"] = options.tags;

  let lastError: EmailProviderError | null = null;

  for (let attempt = 1; attempt <= RESEND_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const json = (await response.json().catch(() => ({}))) as { id?: string };
      return { providerMessageId: json.id ?? "" };
    }

    const detail = await response.text().catch(() => "");
    lastError = new EmailProviderError(response.status, detail || response.statusText);
    console.error(`[email] Resend refused the message [${response.status}]: ${detail}`);

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === RESEND_MAX_ATTEMPTS) break;

    const retryAfter = Number(response.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : RESEND_BASE_BACKOFF_MS * 2 ** (attempt - 1);
    await sleep(Math.min(wait, 8000));
  }

  throw lastError ?? new EmailProviderError(0, "Unknown Resend failure.");
}
