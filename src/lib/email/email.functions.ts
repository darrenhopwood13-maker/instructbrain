import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EmailFailure, EmailStatus, SendOutcome } from "@/lib/email/email.server";

/**
 * Every email the application sends passes through one of these functions, and
 * each is called from an explicit button press. There is no scheduled sender,
 * and no send is attached to issuing a report.
 */

function requiredString(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text === "") throw new Error(`A ${label} is required.`);
  return text;
}

function requiredEmail(value: unknown): string {
  const email = requiredString(value, "recipient email address");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new Error("That does not look like an email address.");
  }
  return email;
}

export const emailConfigurationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<EmailStatus> => {
    const { emailStatus } = await import("@/lib/email/email.server");
    return emailStatus();
  });

export const emailFailures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organisationId: requiredString(
      (input as Record<string, unknown>)?.["organisationId"],
      "organisation id",
    ),
  }))
  .handler(async ({ data, context }): Promise<EmailFailure[]> => {
    const { recentEmailFailures } = await import("@/lib/email/email.server");
    return recentEmailFailures(context.supabase as never, data.organisationId);
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organisationName:
      typeof (input as Record<string, unknown>)?.["organisationName"] === "string"
        ? ((input as Record<string, string>)["organisationName"] as string)
        : "your organisation",
  }))
  .handler(async ({ data, context }): Promise<SendOutcome> => {
    const { sendTestEmail: send } = await import("@/lib/email/email.server");
    return send(
      context.supabase as never,
      context.claims as never,
      data.organisationName,
    );
  });

export const sendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = (input ?? {}) as Record<string, unknown>;
    return {
      organisationId: requiredString(value["organisationId"], "organisation id"),
      email: requiredEmail(value["email"]),
      roleLabel: typeof value["roleLabel"] === "string" ? value["roleLabel"] : "a team member",
      acceptUrl: requiredString(value["acceptUrl"], "invitation link"),
    };
  })
  .handler(async ({ data, context }): Promise<SendOutcome> => {
    const { sendInviteEmail } = await import("@/lib/email/email.server");
    return sendInviteEmail(context.supabase as never, data, {
      id: context.userId,
      claims: context.claims as never,
    });
  });

export const sendReportShared = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = (input ?? {}) as Record<string, unknown>;
    return {
      reportId: requiredString(value["reportId"], "report id"),
      shareId: requiredString(value["shareId"], "share link"),
      email: requiredEmail(value["email"]),
      name: typeof value["name"] === "string" ? value["name"] : null,
    };
  })
  .handler(async ({ data, context }): Promise<SendOutcome> => {
    const { sendReportSharedEmail } = await import("@/lib/email/email.server");
    return sendReportSharedEmail(context.supabase as never, data, {
      id: context.userId,
      claims: context.claims as never,
    });
  });

export const sendTradeExtract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = (input ?? {}) as Record<string, unknown>;
    return {
      reportId: requiredString(value["reportId"], "report id"),
      trade: requiredString(value["trade"], "trade"),
      email: requiredEmail(value["email"]),
      name: typeof value["name"] === "string" ? value["name"] : null,
      directoryId: typeof value["directoryId"] === "string" ? value["directoryId"] : null,
    };
  })
  .handler(async ({ data, context }): Promise<SendOutcome> => {
    const { sendTradeExtractEmail } = await import("@/lib/email/email.server");
    return sendTradeExtractEmail(context.supabase as never, data, {
      id: context.userId,
      claims: context.claims as never,
    });
  });

export const sendCloseOutRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = (input ?? {}) as Record<string, unknown>;
    return {
      reportId: requiredString(value["reportId"], "report id"),
      findingId: requiredString(value["findingId"], "item id"),
      email: requiredEmail(value["email"]),
      name: typeof value["name"] === "string" ? value["name"] : null,
    };
  })
  .handler(async ({ data, context }): Promise<SendOutcome> => {
    const { sendCloseOutRequestEmail } = await import("@/lib/email/email.server");
    return sendCloseOutRequestEmail(context.supabase as never, data, {
      id: context.userId,
      claims: context.claims as never,
    });
  });

export const retrySend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    distributionId: requiredString(
      (input as Record<string, unknown>)?.["distributionId"],
      "send id",
    ),
  }))
  .handler(async ({ data, context }): Promise<SendOutcome> => {
    const { retryDistribution } = await import("@/lib/email/email.server");
    return retryDistribution(context.supabase as never, data.distributionId, {
      id: context.userId,
      claims: context.claims as never,
    });
  });
