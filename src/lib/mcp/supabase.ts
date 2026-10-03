import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

function env(names: string[]): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  for (const name of names) {
    const value = runtime.process?.env?.[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** Forwards the verified OAuth token so RLS runs as the signed-in user. */
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("A signed-in instructBrain user is required.");
  const url = env(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  const key = env(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
