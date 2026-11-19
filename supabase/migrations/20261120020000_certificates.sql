-- ============================================================
-- Certificates: a student uploads, their mentor checks.
--
-- The file goes to a private Storage bucket, `certificates`, in a
-- folder named after the student's id. The row in public.certificates
-- carries what it is and where it stands: pending, verified or
-- rejected (with a note saying why).
--
--  - A student adds and reads their own, and can withdraw one that
--    hasn't been checked yet. They can't mark their own verified.
--  - Their mentor reads them and verifies or rejects them.
--  - The HOD reads all of them.
--
-- The automatic checker in backend/certifications isn't wired in;
-- mentors check by hand until it is.
--
-- Run after 20261120010000_news_and_events.sql. Safe to run more
-- than once.
-- ============================================================

do $$
declare later boolean;
begin
  if to_regclass('private.applied_migrations') is null then
    raise exception 'Run 20261119000000_review_fixes.sql first.';
  end if;
  execute 'select exists (select 1 from private.applied_migrations where version > $1)'
     into later using '20261120020000';
  if later then
    raise exception 'A later migration is already applied; running 20261120020000 again would undo it.';
  end if;
end $$;

do $$ begin
  create type public.certificate_status as enum ('pending', 'verified', 'rejected');
exception when duplicate_object then null;
end $$;

create table if not exists public.certificates (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 200),
  provider    text check (length(provider) <= 120),        -- NPTEL, Coursera, …
  issued_on   date,
  file_path   text not null unique,                        -- <student_id>/<file> in the bucket
  file_name   text not null,
  status      public.certificate_status not null default 'pending',
  note        text check (length(note) <= 500),            -- the mentor's reason, for a rejection
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  check (split_part(file_path, '/', 1) = student_id::text)
);

create index if not exists certificates_student_id_idx on public.certificates (student_id, created_at desc);
create index if not exists certificates_pending_idx on public.certificates (status) where status = 'pending';

-- A student's write is only ever a new pending certificate; a
-- mentor's is only ever a decision, signed with their name.
create or replace function public.guard_certificate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- secret key, SQL Editor

  if tg_op = 'INSERT' then
    new.status := 'pending'; new.note := null;
    new.reviewed_by := null; new.reviewed_at := null;
    return new;
  end if;

  if (new.student_id, new.title, new.provider, new.issued_on, new.file_path, new.file_name, new.created_at)
     is distinct from (old.student_id, old.title, old.provider, old.issued_on, old.file_path, old.file_name, old.created_at) then
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

drop trigger if exists certificates_guard on public.certificates;
create trigger certificates_guard
  before insert or update on public.certificates
  for each row execute function public.guard_certificate();

alter table public.certificates enable row level security;

drop policy if exists "student reads own certificates" on public.certificates;
create policy "student reads own certificates" on public.certificates for select
  using (student_id = (select auth.uid()));
drop policy if exists "student adds own certificates" on public.certificates;
create policy "student adds own certificates" on public.certificates for insert
  with check (student_id = (select auth.uid()));
drop policy if exists "student withdraws own pending certificate" on public.certificates;
create policy "student withdraws own pending certificate" on public.certificates for delete
  using (student_id = (select auth.uid()) and status = 'pending');

drop policy if exists "mentor reads mentees' certificates" on public.certificates;
create policy "mentor reads mentees' certificates" on public.certificates for select
  using (public.mentors(student_id));
drop policy if exists "mentor decides on mentees' certificates" on public.certificates;
create policy "mentor decides on mentees' certificates" on public.certificates for update
  using (public.mentors(student_id))
  with check (public.mentors(student_id));

drop policy if exists "admin reads certificates" on public.certificates;
create policy "admin reads certificates" on public.certificates for select
  using ((select public.is_admin()));

revoke all on public.certificates from anon;
grant select, insert, update, delete on public.certificates to authenticated;


-- ------------------------------------------------------------
-- The files. Private: every read is a signed link, made for
-- someone the rules below let in. 5 MB; PDF, PNG or JPG.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificates', 'certificates', false, 5242880, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Who owns a file: the first folder of its path.
create or replace function private.certificate_owner(p_name text)
returns uuid language sql immutable as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f-]{36}$'
              then split_part(p_name, '/', 1)::uuid end;
$$;
grant execute on function private.certificate_owner(text) to authenticated;

drop policy if exists "certificates: student uploads to own folder" on storage.objects;
create policy "certificates: student uploads to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'certificates' and private.certificate_owner(name) = (select auth.uid()));

drop policy if exists "certificates: student, mentor and HOD read" on storage.objects;
create policy "certificates: student, mentor and HOD read" on storage.objects for select to authenticated
  using (bucket_id = 'certificates' and (
    private.certificate_owner(name) = (select auth.uid())
    or public.mentors(private.certificate_owner(name))
    or (select public.is_admin())));

-- Only while the certificate is still pending, or was never recorded.
drop policy if exists "certificates: student removes own pending file" on storage.objects;
create policy "certificates: student removes own pending file" on storage.objects for delete to authenticated
  using (bucket_id = 'certificates' and private.certificate_owner(name) = (select auth.uid())
    and not exists (select 1 from public.certificates c
                     where c.file_path = objects.name and c.status <> 'pending'));

insert into private.applied_migrations (version) values ('20261120020000')
on conflict (version) do nothing;
