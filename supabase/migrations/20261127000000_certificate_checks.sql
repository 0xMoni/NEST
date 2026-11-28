-- ============================================================
-- The automatic certificate check.
--
-- When a student uploads a certificate, the check-certificate Edge
-- Function reads it and writes what it found here: the provider,
-- course, credential, whether the student's name is on it, whether
-- the verification link is on the provider's own site, and whether
-- the same file was uploaded before. It only advises: the mentor
-- still verifies or rejects, with the check's findings in front of
-- them. Certificate text is easy to fake, so nothing is verified
-- without a person.
--
--  auto_check       what the check found (jsonb; null = not checked)
--  auto_checked_at  when
--  file_sha256      the file's fingerprint, to spot the same file
--                   uploaded twice, by the same or another student
--
-- Only the Edge Function writes these (it uses the secret key). A
-- student or mentor can't set or change them.
--
-- Run after 20261121000000_hod_removes_certificates.sql. Safe to run
-- more than once.
-- ============================================================

do $$
declare later boolean;
begin
  if to_regclass('private.applied_migrations') is null then
    raise exception 'Run 20261119000000_review_fixes.sql first.';
  end if;
  if to_regclass('public.certificates') is null then
    raise exception 'Run 20261120020000_certificates.sql first.';
  end if;
  execute 'select exists (select 1 from private.applied_migrations where version > $1)'
     into later using '20261127000000';
  if later then
    raise exception 'A later migration is already applied; running 20261127000000 again would undo it.';
  end if;
end $$;

alter table public.certificates
  add column if not exists auto_check      jsonb,
  add column if not exists auto_checked_at timestamptz,
  add column if not exists file_sha256     text check (file_sha256 ~ '^[0-9a-f]{64}$');

create index if not exists certificates_file_sha256_idx
  on public.certificates (file_sha256) where file_sha256 is not null;

-- Same as before, plus: a signed-in user can't write the check's
-- columns. The Edge Function writes them with the secret key, which
-- has no auth.uid() and skips this guard.
create or replace function public.guard_certificate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- secret key, SQL Editor

  if tg_op = 'INSERT' then
    new.status := 'pending'; new.note := null;
    new.reviewed_by := null; new.reviewed_at := null;
    new.auto_check := null; new.auto_checked_at := null; new.file_sha256 := null;
    return new;
  end if;

  if (new.student_id, new.title, new.provider, new.issued_on, new.file_path, new.file_name, new.created_at,
      new.auto_check, new.auto_checked_at, new.file_sha256)
     is distinct from (old.student_id, old.title, old.provider, old.issued_on, old.file_path, old.file_name, old.created_at,
      old.auto_check, old.auto_checked_at, old.file_sha256) then
    raise exception using errcode = '42501', message = 'A certificate can''t be changed once uploaded. Remove it and upload again.';
  end if;
  if new.status is distinct from old.status or new.note is distinct from old.note then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  if new.status = 'rejected' and coalesce(trim(new.note), '') = '' then
    raise exception 'Say why it was rejected, so the student can fix it.';
  end if;
  return new;
end;
$$;

insert into private.applied_migrations (version) values ('20261127000000')
on conflict (version) do nothing;
