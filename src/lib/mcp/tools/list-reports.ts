import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_reports",
  title: "List reports",
  description: "List the signed-in user's most recent instructBrain reports.",
  inputSchema: { limit: z.number().int().min(1).max(50).optional().describe("How many reports, default 20.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("reports")
      .select("id, title, status, created_at, updated_at, project_id")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const reports = (data ?? []).map((r) => ({
      id: String(r.id),
      title: r.title == null ? null : String(r.title),
      status: r.status == null ? null : String(r.status),
      project_id: r.project_id == null ? null : String(r.project_id),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    }));
    return { content: [{ type: "text", text: JSON.stringify(reports) }], structuredContent: { reports } };
  },
});
