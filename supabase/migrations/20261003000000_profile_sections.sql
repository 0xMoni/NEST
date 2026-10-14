-- ============================================================
-- Mentor-gated profile editing.
--
-- A student changing their own USN or admission date defeats the
-- point of the system. Contact details genuinely change and should
-- not need a trip to the office. So the profile splits into
-- sections, each locked until a mentor opens a window.
--
-- The lock is a trigger, not a screen. A screen can be skipped by
-- anyone who opens the network tab.
-- ============================================================

create type public.profile_section as enum
  ('student', 'parent', 'guardian', 'contact', 'academic', 'admission');

do $$ begin
  create type public.edit_request_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists dob             date,
  add column if not exists blood_group     text,
  add column if not exists phone           text,
  add column if not exists personal_email  text,
  add column if not exists father_name     text,
  add column if not exists father_phone    text,
  add column if not exists mother_name     text,
  add column if not exists mother_phone    text,
  add column if not exists guardian_name   text,
  add column if not exists guardian_relation text,
  add column if not exists guardian_phone  text,
  add column if not exists address         text,
  add column if not exists city            text,
  add column if not exists pincode         text,
  add column if not exists admission_date  date,
  add column if not exists admission_quota text;

create table if not exists public.profile_edit_requests (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles on delete cascade,
  section      public.profile_section not null,
  status       public.edit_request_status not null default 'pending',
  reason       text,
  requested_at timestamptz not null default now(),
  decided_by   uuid references public.profiles on delete set null,
  decided_at   timestamptz,
  -- a window, not a permanent unlock: approving should not mean forever
  expires_at   timestamptz
);

create index if not exists profile_edit_requests_student_id_section_idx
  on public.profile_edit_requests (student_id, section);

-- one open request per section, so a student cannot queue twenty
create unique index if not exists profile_edit_requests_one_open
  on public.profile_edit_requests (student_id, section)
  where status = 'pending';

-- ---------- helpers ----------

create or replace function public.can_edit_section(s_id uuid, sec public.profile_section)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profile_edit_requests
    where student_id = s_id
      and section = sec
      and status = 'approved'
      and expires_at > now()
  );
$$;

create or replace function public.mentors(s_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.mentorships where student_id = s_id and mentor_id = auth.uid()
  );
$$;

-- ---------- the lock itself ----------

create or replace function public.enforce_profile_locks()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- the office edits anything
  if public.is_admin() then return new; end if;

  -- academic facts are never student-editable, window or not
  if (new.usn, new.dept, new.semester, new.full_name, new.role, new.email)
     is distinct from (old.usn, old.dept, old.semester, old.full_name, old.role, old.email) then
    raise exception 'Academic and identity details are managed by the college office.';
  end if;

  if (new.dob, new.blood_group, new.phone, new.personal_email)
     is distinct from (old.dob, old.blood_group, old.phone, old.personal_email)
     and not public.can_edit_section(old.id, 'student') then
    raise exception 'Student details are locked. Ask your mentor to allow changes.';
  end if;

  if (new.father_name, new.father_phone, new.mother_name, new.mother_phone)
     is distinct from (old.father_name, old.father_phone, old.mother_name, old.mother_phone)
     and not public.can_edit_section(old.id, 'parent') then
    raise exception 'Parent details are locked. Ask your mentor to allow changes.';
  end if;

  if (new.guardian_name, new.guardian_relation, new.guardian_phone)
     is distinct from (old.guardian_name, old.guardian_relation, old.guardian_phone)
     and not public.can_edit_section(old.id, 'guardian') then
    raise exception 'Guardian details are locked. Ask your mentor to allow changes.';
  end if;

  if (new.address, new.city, new.pincode)
     is distinct from (old.address, old.city, old.pincode)
     and not public.can_edit_section(old.id, 'contact') then
    raise exception 'Contact details are locked. Ask your mentor to allow changes.';
  end if;

  if (new.admission_date, new.admission_quota)
     is distinct from (old.admission_date, old.admission_quota)
     and not public.can_edit_section(old.id, 'admission') then
    raise exception 'Admission details are locked. Ask your mentor to allow changes.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_section_locks on public.profiles;
drop trigger if exists profiles_section_locks on public.profiles;
create trigger profiles_section_locks
  before update on public.profiles
  for each row execute function public.enforce_profile_locks();

-- ---------- policies ----------

alter table public.profile_edit_requests enable row level security;

drop policy if exists "student reads own requests" on public.profile_edit_requests;
create policy "student reads own requests" on public.profile_edit_requests
  for select using (student_id = auth.uid());

drop policy if exists "student asks" on public.profile_edit_requests;
create policy "student asks" on public.profile_edit_requests
  for insert with check (student_id = auth.uid() and status = 'pending');

-- withdrawing is deleting your own pending request; a decided one stays as record
drop policy if exists "student withdraws own pending" on public.profile_edit_requests;
create policy "student withdraws own pending" on public.profile_edit_requests
  for delete using (student_id = auth.uid() and status = 'pending');

drop policy if exists "mentor reads their mentees' requests" on public.profile_edit_requests;
create policy "mentor reads their mentees' requests" on public.profile_edit_requests
  for select using (public.mentors(student_id));

drop policy if exists "mentor decides" on public.profile_edit_requests;
create policy "mentor decides" on public.profile_edit_requests
  for update using (public.mentors(student_id)) with check (public.mentors(student_id));

drop policy if exists "admin sees every request" on public.profile_edit_requests;
create policy "admin sees every request" on public.profile_edit_requests
  for all using (public.is_admin()) with check (public.is_admin());
