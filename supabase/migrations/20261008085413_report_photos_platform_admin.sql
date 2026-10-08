-- Every table in this schema carries a permissive "platform admin full access"
-- policy, so a platform admin can read an organisation's content without being a
-- member of it: findings, finding_photos, photos, projects, memberships and
-- twenty more. Storage was the one place that policy was missing.
--
-- The consequence, found by walking the live app on 8 October 2026: a platform
-- admin opening a report belonging to ANOTHER organisation saw every finding and
-- every item row, and no photographs at all - "Photograph unavailable" on
-- screen, and the same in the PDF. Nothing was missing: all fourteen full images
-- and all fourteen thumbnails were present in the bucket, and every path in the
-- database was correct. The signed URL was simply refused, because the only read
-- policy on this bucket asked whether the reader was a member of the
-- organisation that owns the file, and never whether they were a platform admin.
--
-- Scoped to this bucket rather than to storage.objects as a whole. The
-- platform-admin pattern everywhere else removes the ORGANISATION gate, not the
-- BUCKET gate, and that distinction should survive even though `report-photos`
-- is currently the only bucket in the project. The narrower form is also the one
-- that stays correct when a second bucket appears.

drop policy if exists "platform admin full access" on storage.objects;

create policy "platform admin full access" on storage.objects
  for all to authenticated
  using (bucket_id = 'report-photos' and public.is_platform_admin())
  with check (bucket_id = 'report-photos' and public.is_platform_admin());
