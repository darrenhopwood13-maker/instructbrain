/**
 * Email configuration and the one place the provider key is resolved.
 *
 * Nothing here touches the network, so it is safe to unit test. The rule the
 * rest of the system depends on: a missing key is a loud, admin-facing error.
 * It is never swallowed, and an unsent email is never reported as sent.
 */

/** The verified sending domain. */
export const SENDER_DOMAIN = "instructbrain.com";

/** Visible sender on every message the application sends. */
export const FROM_ADDRESS = `instructBrain <reports@${SENDER_DOMAIN}>`;

/** Replies go to a monitored address, never to a no-reply black hole. */
export const REPLY_TO_ADDRESS = `replies@${SENDER_DOMAIN}`;

/** Retry policy for provider rate limits and transient failures. */
export const RESEND_MAX_ATTEMPTS = 4;
export const RESEND_BASE_BACKOFF_MS = 500;

/**
 * Raised when the provider key is absent or malformed. Every send path lets
 * this surface to the person who triggered it — silence would be worse than
 * failure, because a subcontractor would never learn they had snags.
 */
export class EmailConfigurationError extends Error {
  readonly adminMessage: string;

  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
    this.adminMessage = message;
  }
}

/** Raised when the provider rejected the message. Carries the real error. */
export class EmailProviderError extends Error {
  readonly status: number;
  readonly providerError: string;

  constructor(status: number, providerError: string) {
    super(`Resend rejected the message (HTTP ${status}): ${providerError}`);
    this.name = "EmailProviderError";
    this.status = status;
    this.providerError = providerError;
  }
}

export const MISSING_KEY_MESSAGE =
  "Email is not configured: RESEND_API_KEY is missing from this project's secrets. " +
  "Nothing was sent. An owner or admin must add RESEND_API_KEY in Project Settings → Secrets, " +
  "using a key from a Resend account with " +
  SENDER_DOMAIN +
  " verified.";

/**
 * Resolves the provider key, or throws. Pure so the failure path is testable
 * without a network or a server runtime.
 */
export function resolveResendKey(value: string | undefined | null): string {
  const key = (value ?? "").trim();
  if (!key) throw new EmailConfigurationError(MISSING_KEY_MESSAGE);
  if (!key.startsWith("re_")) {
    throw new EmailConfigurationError(
      "Email is not configured correctly: RESEND_API_KEY does not look like a Resend key " +
        "(it should start with 're_'). Nothing was sent.",
    );
  }
  return key;
}

/** True when a usable key is present. Used by the admin status panel only. */
export function isResendConfigured(value: string | undefined | null): boolean {
  try {
    resolveResendKey(value);
    return true;
  } catch {
    return false;
  }
}
