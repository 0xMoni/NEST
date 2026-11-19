-- Refuses to run once a later migration is applied: running an old
-- file again puts back what later ones fixed. See 20261119000000.
do $$
declare later boolean;
begin
  if to_regclass('private.applied_migrations') is not null then
    execute 'select exists (select 1 from private.applied_migrations where version > $1)'
       into later using '20261116010000';
    if later then
      raise exception 'A later migration is already applied; running 20261116010000 again would undo it.';
    end if;
  end if;
end $$;

-- ============================================================
-- Tidy up: what the app actually uses, and nothing it doesn't.
--
--  1. Students see their teachers' names and their mentor's
--     contact card, not every teacher's private details.
--  2. A section can't have two classes in the same period.
--  3. Attendance is present or absent; nothing else.
--  4. Indexes for the lookups the pages and policies make.
--  5. ai_quiz_attempts was made by hand in the dashboard; this
--     writes it down, with its access rules.
--  6. Gone: profiles.avatar_url (never used) and the duplicate
--     current_role_is() helper (is_admin() does the same job).
--
-- Run after 20261116000000_lock_down_access.sql. Safe to run more
-- than once.
-- ============================================================


-- ------------------------------------------------------------
-- 1. What students see of their teachers.
--
-- "student reads faculty who teach them" and "student reads their
-- mentor" let a student read the whole profile row of every teacher
-- in their section: date of birth, home address, personal email.
-- They need a name per subject, and their mentor's contact card.
-- Both views run as their owner, and their WHERE clause is the rule.
-- ------------------------------------------------------------
drop policy if exists "student reads faculty who teach them" on public.profiles;
drop policy if exists "student reads their mentor" on public.profiles;

-- Who teaches each subject in the signed-in student's section.
create or replace view public.v_my_teachers as
select fa.id as assignment_id, fa.section_id, fa.subject_id,
       s.code as subject_code, s.name as subject_name,
       p.full_name as faculty_name
  from public.faculty_assignments fa
  join public.subjects s on s.id = fa.subject_id
  join public.profiles p on p.id = fa.faculty_id
 where public.studies_in_section(fa.section_id);

-- The signed-in student's mentor: what goes on the contact card.
create or replace view public.v_my_mentor as
select m.student_id, p.id as mentor_id, p.full_name, p.designation,
       p.email, p.phone, p.cabin, p.office_hours
  from public.mentorships m
  join public.profiles p on p.id = m.mentor_id
 where m.student_id = auth.uid();

revoke all on public.v_my_teachers, public.v_my_mentor from anon;
grant select on public.v_my_teachers, public.v_my_mentor to authenticated;


-- ------------------------------------------------------------
-- 2. One class per section per period.
--
-- The unique key on timetable_slots is per teaching assignment, so
-- two different subjects could land in the same section's period.
-- The HOD page clears a slot before filling it; this makes it a rule.
-- Existing rows are not checked, only new and changed ones.
-- ------------------------------------------------------------
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
       and t.id <> new.id
  ) then
    raise exception using errcode = '23505',
      message = 'That section already has a class in this period. Clear it first.';
  end if;
  return new;
end;
$$;

drop trigger if exists timetable_slots_one_per_period on public.timetable_slots;
create trigger timetable_slots_one_per_period
  before insert or update on public.timetable_slots
  for each row execute function public.prevent_section_double_booking();


-- ------------------------------------------------------------
-- 3. Present or absent.
--
-- The status type also has 'late' and 'excused', but nothing marks
-- them and the department counts attendance as present/absent.
-- Postgres can't drop a value from a type in place, so a check
-- does the job. NOT VALID: rows already saved are left as they are
-- (and the views still count late/excused as attended, if any exist).
-- ------------------------------------------------------------
alter table public.attendance_records drop constraint if exists attendance_records_present_or_absent;
alter table public.attendance_records add constraint attendance_records_present_or_absent
  check (status in ('present', 'absent')) not valid;
alter table public.attendance_records alter column status set default 'present';


-- ------------------------------------------------------------
-- 4. Indexes. Foreign keys don't get one automatically, and these
-- three are filtered on by the pages or inside the access rules.
-- ------------------------------------------------------------
create index if not exists assessments_assignment_id_idx on public.assessments (assignment_id);
create index if not exists section_students_student_id_idx on public.section_students (student_id);
create index if not exists mentor_alerts_mentor_id_idx on public.mentor_alerts (mentor_id, created_at desc);


-- ------------------------------------------------------------
-- 5. AI quiz attempts.
--
-- Created by hand in the dashboard, so no migration had it. If the
-- table is already there it is left as it is; either way its access
-- rules are reset to these, so nothing made by hand lingers.
-- ------------------------------------------------------------
create table if not exists public.ai_quiz_attempts (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.profiles on delete cascade,
  topic           text not null,
  score           integer not null,
  total_questions integer not null,
  difficulty      text not null default 'Intermediate',
  quiz_data       jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists ai_quiz_attempts_student_id_idx on public.ai_quiz_attempts (student_id, created_at desc);
alter table public.ai_quiz_attempts enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'ai_quiz_attempts' loop
    execute format('drop policy %I on public.ai_quiz_attempts', pol.policyname);
  end loop;
end $$;

create policy "student manages own quiz attempts" on public.ai_quiz_attempts for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
create policy "mentor or admin reads quiz attempts" on public.ai_quiz_attempts for select
  using (public.is_admin() or public.mentors(student_id));


-- ------------------------------------------------------------
-- 6. Removed.
-- ------------------------------------------------------------

-- Never set, never shown.
alter table public.profiles drop column if exists avatar_url;

-- current_role_is('admin') and is_admin() were the same check. The
-- last policies using it move to is_admin(); then it goes.
drop policy if exists "admin reads every profile" on public.profiles;
create policy "admin reads every profile" on public.profiles for select
  using (public.is_admin());

drop policy if exists "admin writes every profile" on public.profiles;
create policy "admin writes every profile" on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- If something made by hand still uses it, keep it rather than fail.
do $$
begin
  drop function if exists public.current_role_is(public.user_role);
exception when dependent_objects_still_exist then
  raise notice 'current_role_is() is still used by something outside the migrations; left in place.';
end $$;
