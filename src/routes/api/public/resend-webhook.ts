import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend delivery webhooks: delivered, bounced, opened.
 *
 * A bounced trade extract means a subcontractor never received their items, so
 * the distribution row is marked plainly and surfaced in organisation settings
 * with a retry action.
 */

function verify(secret: string, headers: Headers, body: string): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");

  return signature
    .split(" ")
    .map((part) => part.split(",")[1] ?? "")
    .some((candidate) => {
      const a = Buffer.from(candidate);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    });
}

export const Route = createFileRoute("/api/public/resend-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = (process.env["RESEND_WEBHOOK_SECRET"] ?? "").trim();
        if (!secret) {
          console.error("[email] webhook received but RESEND_WEBHOOK_SECRET is not configured");
          return Response.json(
            {
              error:
                "Delivery webhooks are not configured: RESEND_WEBHOOK_SECRET is missing from this project's secrets.",
            },
            { status: 503 },
          );
        }

        const body = await request.text();
        if (!verify(secret, request.headers, body)) {
          return Response.json({ error: "Invalid signature." }, { status: 401 });
        }

        let event: { type?: string; data?: { email_id?: string; bounce?: { message?: string } } };
        try {
          event = JSON.parse(body);
        } catch {
          return Response.json({ error: "Invalid payload." }, { status: 400 });
        }

        const messageId = event.data?.email_id;
        if (!messageId) return Response.json({ ok: true });

        const patch: Record<string, unknown> = {};
        switch (event.type) {
          case "email.delivered":
            patch["status"] = "delivered";
            break;
          case "email.opened":
            patch["opened_at"] = new Date().toISOString();
            break;
          case "email.bounced":
          case "email.complained":
            patch["status"] = event.type === "email.bounced" ? "bounced" : "complained";
            patch["error"] =
              event.data?.bounce?.message ?? "The recipient's mail server rejected the message.";
            break;
          default:
            return Response.json({ ok: true });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await (supabaseAdmin as any)
          .from("distributions")
          .update(patch)
          .eq("recipient_snapshot->>provider_message_id", messageId);
        if (error) {
          console.error("[email] webhook could not update the distribution:", error.message);
          return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
