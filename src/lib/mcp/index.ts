import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listReportsTool from "./tools/list-reports";
import listProjectsTool from "./tools/list-projects";

// The issuer must be the direct Supabase host; the project ref is inlined at build time.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "instructbrain",
  title: "instructBrain",
  version: "0.1.0",
  instructions:
    "Read-only access to the signed-in user's instructBrain projects and reports. Use list_projects and list_reports.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjectsTool, listReportsTool],
});
