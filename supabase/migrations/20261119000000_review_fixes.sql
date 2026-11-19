-- ============================================================
-- Fixes from the review of 18 November.
--
--  1. The role sync copies only what changed in app_metadata.
--  2. Only a real password change clears must_change_password.
--  3. Migrations refuse to run again once a later one is applied.
--  4. A section can't be marked twice for the same period, and a
--     student can't be enrolled in two sections.
--  5. Periods are 1 to 6.
--  6. Teachers can't delete a class they took, or its records.
--  7. Students read their AI quiz attempts and roadmaps but can't
--     write them; the backend does, with the secret key.
--  8. The helper functions are for signed-in users only.
--
-- Run after 20261118010000_advisor_fixes.sql. Safe to run more
-- than once.
-- ============================================================


-- ------------------------------------------------------------
-- 3. Which migrations this database has.
--
-- The files are pasted into the SQL Editor by hand, and most of
-- them redefine functions, views and policies. Pasting an old one
-- again quietly puts back what a later one fixed: the first file,
-- for one, makes sign-ups trust user_metadata again, which let
-- anyone sign up as HOD. So every file records itself here, and
-- every file before this one now starts by refusing to run if a
-- later version is listed.
--
-- New migrations: copy the guard at the top of this file, and the
-- insert at the bottom, with your own version.
-- ------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;

create table if not exists private.applied_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);
revoke all on private.applied_migrations from public, anon, authenticated;

do $$ begin
  -- this file marks everything before it as applied, so check that it is
  if to_regprocedure('private.class_roster()') is null
     or to_regprocedure('public.sync_profile_from_app_metadata()') is null then
    raise exception 'Run 20261118000000_role_from_app_metadata.sql and 20261118010000_advisor_fixes.sql first.';
  end if;
  if exists (select 1 from private.applied_migrations where version > '20261119000000') then
    raise exception 'A later migration is already applied; running 20261119000000 again would undo it.';
  end if;
end $$;

-- Everything up to 18 November, which this file runs after.
insert into private.applied_migrations (version) values
  ('20260930000000'), ('20261001000000'), ('20261002000000'), ('20261003000000'),
  ('20261004000000'), ('20261006000000'), ('20261006010000'), ('20261006020000'),
  ('20261007000000'), ('20261007020000'), ('20261008000000'), ('20261008010000'),
  ('20261116000000'), ('20261116010000'), ('20261117000000'), ('20261118000000'),
  ('20261118010000')
on conflict (version) do nothing;


-- ------------------------------------------------------------
-- 1. The role sync copies only what changed.
--
-- 20261118000000 copied every key in app_metadata to the profile
-- whenever app_metadata changed at all. So a student moved to
-- semester 6 in the profile went back to 5 the next time anything
-- in their app_metadata was touched. Now a key is copied only when
-- this update set it to something new.
-- ------------------------------------------------------------
create or replace function private.app_key_changed(app jsonb, was jsonb, k text)
returns text language sql immutable as $$
  select case when app -> k is distinct from was -> k then nullif(app ->> k, '') end;
$$;

create or replace function public.sync_profile_from_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  app jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  was jsonb := coalesce(old.raw_app_meta_data, '{}'::jsonb);
begin
  if app = was then
    return new;
  end if;

  update public.profiles p
     set role        = coalesce(private.app_key_changed(app, was, 'role')::public.user_role, p.role),
         usn         = coalesce(upper(private.app_key_changed(app, was, 'usn')), p.usn),
         dept        = coalesce(upper(private.app_key_changed(app, was, 'dept')), p.dept),
         semester    = coalesce(private.app_key_changed(app, was, 'semester')::smallint, p.semester),
         full_name   = coalesce(private.app_key_changed(app, was, 'full_name'), p.full_name),
         designation = coalesce(private.app_key_changed(app, was, 'designation'), p.designation),
         phone       = coalesce(private.app_key_changed(app, was, 'phone'), p.phone)
   where p.id = new.id;

  return new;
end;
$$;


-- ------------------------------------------------------------
-- 2. must_change_password follows the password.
--
-- The flag was cleared by the page, with an ordinary profile
-- update, so anyone could clear their own without changing the
-- password: one request from the browser console. Now it clears
-- when the password in auth.users actually changes, and a signed-in
-- user can't change the flag any other way. The HOD still can.
--
-- If the office resets someone's password with the secret key, the
-- flag clears too: set it back to true afterwards.
-- ------------------------------------------------------------
create or replace function public.password_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    -- tells guard_must_change_password() that this change is allowed
    perform set_config('nest.password_changed', new.id::text, true);
    update public.profiles set must_change_password = false
     where id = new.id and must_change_password;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_password_changed on auth.users;
create trigger on_auth_user_password_changed
  after update of encrypted_password on auth.users
  for each row execute function public.password_changed();

create or replace function public.guard_must_change_password()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.must_change_password is distinct from old.must_change_password
     and auth.uid() is not null
     and current_setting('nest.password_changed', true) is distinct from new.id::text
     and not public.is_admin() then
    raise exception using errcode = '42501',
      message = 'This clears by itself when you change your password.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_must_change_password on public.profiles;
create trigger profiles_guard_must_change_password
  before update of must_change_password on public.profiles
  for each row execute function public.guard_must_change_password();


-- ------------------------------------------------------------
-- 4a. One class per section per period, in attendance too.
--
-- The timetable already refuses two classes in one section's
-- period. Attendance didn't: two subjects could both be marked for
-- 5B, period 3 on the same day, and a student marked absent in both
-- loses two classes for one. The same subject again is still fine;
-- that is a correction, and the unique key turns it into an update.
-- ------------------------------------------------------------
create or replace function public.prevent_section_double_marking()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  clash text;
begin
  select sub.name into clash
    from public.attendance_sessions s
    join public.faculty_assignments a on a.id = s.assignment_id
    join public.faculty_assignments b on b.id = new.assignment_id
    join public.subjects sub on sub.id = a.subject_id
   where s.held_on = new.held_on
     and s.period = new.period
     and a.section_id = b.section_id
     and s.assignment_id <> new.assignment_id
   limit 1;
  if clash is not null then
    raise exception using errcode = '23505',
      message = 'This section already has ' || clash || ' marked for that period on that day.';
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_sessions_one_per_period on public.attendance_sessions;
create trigger attendance_sessions_one_per_period
  before insert or update of assignment_id, held_on, period on public.attendance_sessions
  for each row execute function public.prevent_section_double_marking();

-- The timetable rule compared slot ids, so re-inserting a slot that
-- already exists (insert … on conflict do nothing) clashed with
-- itself before the conflict was seen. The same class in the same
-- slot is the unique key's business, not a double booking.
create or replace function public.prevent_section_double_booking()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1
      from public.timetable_slots t
      join public.faculty_assignments a on a.id = t.assignment_id
      join public.faculty_assignments b on b.id = new.assignment_id
     where t.day_of_week = new.day_of_week
       and t.period = new.period
       and a.section_id = b.section_id
       and t.assignment_id <> new.assignment_id
  ) then
    raise exception using errcode = '23505',
      message = 'That section already has a class in this period. Clear it first.';
  end if;
  return new;
end;
$$;


-- ------------------------------------------------------------
-- 4b. A student is in one section.
--
-- Nothing stopped it, and one student already is in two (the
-- office has to choose which). Existing rows are left alone; new
-- enrolments are checked. Enrolling someone again in the section
-- they are already in is still fine.
-- ------------------------------------------------------------
create or replace function public.one_section_per_student()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.section_students
     where student_id = new.student_id and section_id <> new.section_id
  ) then
    raise exception using errcode = '23505',
      message = 'This student is already enrolled in another section. Remove them from it first.';
  end if;
  return new;
end;
$$;

drop trigger if exists section_students_one_section on public.section_students;
create trigger section_students_one_section
  before insert or update on public.section_students
  for each row execute function public.one_section_per_student();


-- ------------------------------------------------------------
-- 5. Six periods a day.
--
-- The tables allowed 1 to 8; the college day has 6. NOT VALID so a
-- stray row already saved doesn't stop this file; it is then
-- validated if nothing is out of range.
-- ------------------------------------------------------------
alter table public.timetable_slots drop constraint if exists timetable_slots_six_periods;
alter table public.timetable_slots add constraint timetable_slots_six_periods
  check (period between 1 and 6) not valid;
alter table public.attendance_sessions drop constraint if exists attendance_sessions_six_periods;
alter table public.attendance_sessions add constraint attendance_sessions_six_periods
  check (period between 1 and 6) not valid;

do $$ begin
  alter table public.timetable_slots validate constraint timetable_slots_six_periods;
  alter table public.attendance_sessions validate constraint attendance_sessions_six_periods;
exception when check_violation then
  raise notice 'Some saved rows have a period above 6; they stay, new ones are refused.';
end $$;


-- ------------------------------------------------------------
-- 6. A class that was taken stays taken.
--
-- "for all" included delete, so a teacher could delete a session
-- and its attendance went with it, with no trace. Teachers now
-- read, add and correct; deleting is for the office, in the SQL
-- Editor.
-- ------------------------------------------------------------
drop policy if exists "faculty manages own sessions" on public.attendance_sessions;
drop policy if exists "faculty reads own sessions" on public.attendance_sessions;
drop policy if exists "faculty adds own sessions" on public.attendance_sessions;
drop policy if exists "faculty corrects own sessions" on public.attendance_sessions;
create policy "faculty reads own sessions" on public.attendance_sessions for select
  using (public.teaches_assignment(assignment_id));
create policy "faculty adds own sessions" on public.attendance_sessions for insert
  with check (public.teaches_assignment(assignment_id) and taken_by = (select auth.uid()));
create policy "faculty corrects own sessions" on public.attendance_sessions for update
  using (public.teaches_assignment(assignment_id))
  with check (public.teaches_assignment(assignment_id) and taken_by = (select auth.uid()));

drop policy if exists "faculty manages attendance for own classes" on public.attendance_records;
drop policy if exists "faculty reads attendance for own classes" on public.attendance_records;
drop policy if exists "faculty marks attendance for own classes" on public.attendance_records;
drop policy if exists "faculty corrects attendance for own classes" on public.attendance_records;
create policy "faculty reads attendance for own classes" on public.attendance_records for select
  using (exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id and public.teaches_assignment(s.assignment_id)
  ));
create policy "faculty marks attendance for own classes" on public.attendance_records for insert
  with check (exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id and public.teaches_assignment(s.assignment_id)
  ) and public.enrolled_in_session(session_id, student_id));
create policy "faculty corrects attendance for own classes" on public.attendance_records for update
  using (exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id and public.teaches_assignment(s.assignment_id)
  ))
  with check (exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id and public.teaches_assignment(s.assignment_id)
  ) and public.enrolled_in_session(session_id, student_id));


-- ------------------------------------------------------------
-- 7. AI results come from the backend, not the browser.
--
-- A student could insert any score they liked, and their mentor
-- would read it as a real attempt. Nothing in the web app writes
-- these tables; whatever runs the AI writes them with the secret
-- key, which row-level security doesn't apply to.
-- ------------------------------------------------------------
drop policy if exists "student manages own quiz attempts" on public.ai_quiz_attempts;
drop policy if exists "student reads own quiz attempts" on public.ai_quiz_attempts;
create policy "student reads own quiz attempts" on public.ai_quiz_attempts for select
  using (student_id = (select auth.uid()));

drop policy if exists "student manages own roadmaps" on public.ai_roadmaps;
drop policy if exists "student reads own roadmaps" on public.ai_roadmaps;
create policy "student reads own roadmaps" on public.ai_roadmaps for select
  using (student_id = (select auth.uid()));


-- ------------------------------------------------------------
-- 8. Helpers are for signed-in users.
--
-- Postgres lets everyone (PUBLIC) execute a new function, and
-- revoking from anon alone leaves that in place, so a visitor with
-- only the publishable key could call is_admin(), mentors() and the
-- rest through the API. Each answers about auth.uid(), which is
-- null for them, so little leaked, but they were never meant to be
-- callable from outside.
-- ------------------------------------------------------------
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p
     where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
       and p.prorettype <> 'trigger'::regtype
       and p.proname in (
         'is_admin', 'teaches_assignment', 'teaches_section', 'studies_in_section',
         'can_edit_section', 'mentors', 'mentors_in_section', 'mentors_in_assignment',
         'enrolled_in_session', 'enrolled_for_assessment')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Only the sync trigger above uses this; it runs as the owner.
revoke all on function private.app_key_changed(jsonb, jsonb, text) from public, anon, authenticated;


insert into private.applied_migrations (version) values ('20261119000000')
on conflict (version) do nothing;
