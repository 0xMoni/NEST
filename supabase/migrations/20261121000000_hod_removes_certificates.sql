-- ============================================================
-- The HOD can remove a certificate, and its file.
--
-- A student can withdraw one only until their mentor has checked
-- it, and nobody could remove a checked one, so a certificate
-- uploaded or verified by mistake needed the secret key. Now the
-- HOD can remove any, from the student's report page. Mentors
-- still can't: a verified record stays unless the office takes it
-- out.
--
-- Run after 20261120020000_certificates.sql. Safe to run more than
-- once.
-- ============================================================

do $$
declare later boolean;
begin
  if to_regclass('private.applied_migrations') is null then
    raise exception 'Run 20261119000000_review_fixes.sql first.';
  end if;
  execute 'select exists (select 1 from private.applied_migrations where version > $1)'
     into later using '20261121000000';
  if later then
    raise exception 'A later migration is already applied; running 20261121000000 again would undo it.';
  end if;
end $$;

drop policy if exists "admin removes certificates" on public.certificates;
create policy "admin removes certificates" on public.certificates for delete
  using ((select public.is_admin()));

drop policy if exists "certificates: HOD removes any file" on storage.objects;
create policy "certificates: HOD removes any file" on storage.objects for delete to authenticated
  using (bucket_id = 'certificates' and (select public.is_admin()));

insert into private.applied_migrations (version) values ('20261121000000')
on conflict (version) do nothing;
