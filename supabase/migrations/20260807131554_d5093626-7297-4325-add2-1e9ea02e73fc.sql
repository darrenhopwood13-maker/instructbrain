-- Helpers used by RLS policies / signed-in users: authenticated + service_role keep EXECUTE
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.has_org_role(uuid, public.app_role[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, public.app_role[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, public.app_role[]) TO service_role;

REVOKE ALL ON FUNCTION public.project_org(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.project_org(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.project_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_org(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.report_org(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_org(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_org(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.finding_org(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finding_org(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.finding_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finding_org(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.directory_org(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.directory_org(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.directory_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.directory_org(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.directory_template_org(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.directory_template_org(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.directory_template_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.directory_template_org(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.finding_is_confidential(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finding_is_confidential(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.finding_is_confidential(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finding_is_confidential(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.create_organisation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_organisation(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_organisation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organisation(text) TO service_role;

REVOKE ALL ON FUNCTION public.safe_uuid(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.safe_uuid(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.safe_uuid(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.safe_uuid(text) TO service_role;

-- Trigger-only functions: no role needs to call these directly
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;

REVOKE ALL ON FUNCTION public.findings_ref_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.findings_ref_immutable() FROM anon;
REVOKE ALL ON FUNCTION public.findings_ref_immutable() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.findings_ref_immutable() TO service_role;

REVOKE ALL ON FUNCTION public.findings_locked_when_issued() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.findings_locked_when_issued() FROM anon;
REVOKE ALL ON FUNCTION public.findings_locked_when_issued() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.findings_locked_when_issued() TO service_role;

REVOKE ALL ON FUNCTION public.findings_confidentiality_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.findings_confidentiality_transition() FROM anon;
REVOKE ALL ON FUNCTION public.findings_confidentiality_transition() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.findings_confidentiality_transition() TO service_role;

REVOKE ALL ON FUNCTION public.distributions_block_confidential() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.distributions_block_confidential() FROM anon;
REVOKE ALL ON FUNCTION public.distributions_block_confidential() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.distributions_block_confidential() TO service_role;

REVOKE ALL ON FUNCTION public.report_shares_expiry_rules() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_shares_expiry_rules() FROM anon;
REVOKE ALL ON FUNCTION public.report_shares_expiry_rules() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.report_shares_expiry_rules() TO service_role;