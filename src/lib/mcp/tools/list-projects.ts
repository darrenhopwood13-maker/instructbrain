import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_projects",
  title: "List projects",
  description: "List the projects in the signed-in user's instructBrain organisation.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("projects")
      .select("id, name, reference, client_name, address, status")
      .order("updated_at", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const projects = (data ?? []).map((p) => ({
      id: String(p.id),
      name: String(p.name),
      reference: p.reference == null ? null : String(p.reference),
      client: p.client_name == null ? null : String(p.client_name),
      address: p.address == null ? null : String(p.address),
      status: p.status == null ? null : String(p.status),
    }));
    return { content: [{ type: "text", text: JSON.stringify(projects) }], structuredContent: { projects } };
  },
});
