-- Refuses to run once a later migration is applied: running an old
-- file again puts back what later ones fixed. See 20261119000000.
do $$
declare later boolean;
begin
  if to_regclass('private.applied_migrations') is not null then
    execute 'select exists (select 1 from private.applied_migrations where version > $1)'
       into later using '20261116000000';
    if later then
      raise exception 'A later migration is already applied; running 20261116000000 again would undo it.';
    end if;
  end if;
end $$;

-- ============================================================
-- Lock down access, now that the browser talks to the database
-- directly and row-level security is the only lock there is.
--
--  1. Signing up can no longer make anyone HOD (or claim a USN).
--  2. Teachers no longer read every student's private details.
--  3. Mentors see their mentees' attendance and marks in every
--     subject, not only the ones they teach.
--  4. Staff can keep their own phone number current.
--  5. Accounts get their department and semester.
--  6. Removing a teaching assignment can no longer wipe a term's
--     attendance and marks.
--  7. Writes can't be signed in someone else's name, and teachers
--     can't mark students outside the class.
--  8. AI roadmaps: mentors and the HOD, not every teacher.
--
-- Safe to run more than once.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Who someone is comes from app_metadata.
--
-- user_metadata is whatever the person signing up sends, so
-- reading role from it let anyone call signUp with
-- { role: 'admin' } and become HOD. app_metadata can only be set
-- with the secret key (the admin API the scripts use), so it is
-- the only place role, USN, department and semester are taken
-- from. A plain sign-up is always a student with no USN.
--
-- Also turn off public sign-ups in the dashboard: Authentication
-- -> Sign In / Providers -> "Allow new users to sign up". Accounts
-- are made by the office; nobody needs to make their own.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  app jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  usr jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, full_name, role, usn, dept, semester, phone, designation)
  values (
    new.id,
    new.email,
    coalesce(nullif(app ->> 'full_name', ''), usr ->> 'full_name', ''),
    coalesce((nullif(app ->> 'role', ''))::public.user_role, 'student'),
    nullif(upper(app ->> 'usn'), ''),
    nullif(upper(app ->> 'dept'), ''),
    (nullif(app ->> 'semester', ''))::smallint,
    nullif(coalesce(app ->> 'phone', usr ->> 'phone'), ''),
    nullif(app ->> 'designation', '')
  );
  return new;
end;
$$;


-- ------------------------------------------------------------
-- 4 (and what 5 needs). The profile lock.
--
-- The section locks (student, parent, guardian, contact,
-- admission) exist so a student can't quietly rewrite their own
-- record. They also caught faculty, who could not change their own
-- phone number. They now apply to students only; identity fields
-- stay office-only for everyone.
--
-- No signed-in user (auth.uid() is null) means the secret key, a
-- migration or the SQL editor: the office's own tools. Ordinary
-- requests can't get here without a user, because the only update
-- policy on profiles requires auth.uid() = id.
-- ------------------------------------------------------------
create or replace function public.enforce_profile_locks()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;

  if (new.usn, new.dept, new.semester, new.full_name, new.role, new.email)
     is distinct from (old.usn, old.dept, old.semester, old.full_name, old.role, old.email) then
    raise exception 'Academic and identity details are managed by the college office.';
  end if;

  -- staff keep their own contact details current; the locks are for student records
  if old.role <> 'student' then return new; end if;

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


-- ------------------------------------------------------------
-- 5. Department and semester, for students already enrolled.
--
-- The old trigger never stored them, so every profile shows them
-- blank. A student's section says both.
-- ------------------------------------------------------------
update public.profiles p
   set dept = s.dept, semester = s.semester
  from public.section_students ss
  join public.sections s on s.id = ss.section_id
 where ss.student_id = p.id
   and p.role = 'student'
   and (p.dept is distinct from s.dept or p.semester is distinct from s.semester)
   -- someone in two sections (should not happen) is left for the office to sort out
   and (select count(*) from public.section_students x where x.student_id = p.id) = 1;

-- …and from now on, enrolling a student fills them in.
create or replace function public.sync_student_section()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p
     set dept = s.dept, semester = s.semester
    from public.sections s
   where s.id = new.section_id
     and p.id = new.student_id
     and p.role = 'student'
     and (p.dept is distinct from s.dept or p.semester is distinct from s.semester);
  return new;
end;
$$;

drop trigger if exists section_students_sync_profile on public.section_students;
create trigger section_students_sync_profile
  after insert on public.section_students
  for each row execute function public.sync_student_section();


-- ------------------------------------------------------------
-- Helpers. security definer so policies can use them without
-- tripping the policies they are part of.
-- ------------------------------------------------------------

-- Does the signed-in teacher mentor anyone in this section?
create or replace function public.mentors_in_section(s_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.mentorships m
    join public.section_students ss on ss.student_id = m.student_id
    where m.mentor_id = auth.uid() and ss.section_id = s_id
  );
$$;

-- …in the section this teaching assignment belongs to?
create or replace function public.mentors_in_assignment(a_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.faculty_assignments fa
    join public.section_students ss on ss.section_id = fa.section_id
    join public.mentorships m on m.student_id = ss.student_id
    where fa.id = a_id and m.mentor_id = auth.uid()
  );
$$;

-- Is this student in the class this attendance session was for?
create or replace function public.enrolled_in_session(sess uuid, stu uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.attendance_sessions s
    join public.faculty_assignments fa on fa.id = s.assignment_id
    join public.section_students ss on ss.section_id = fa.section_id
    where s.id = sess and ss.student_id = stu
  );
$$;

-- …in the class this assessment was set for?
create or replace function public.enrolled_for_assessment(asm uuid, stu uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assessments a
    join public.faculty_assignments fa on fa.id = a.assignment_id
    join public.section_students ss on ss.section_id = fa.section_id
    where a.id = asm and ss.student_id = stu
  );
$$;

revoke all on function public.mentors_in_section(uuid), public.mentors_in_assignment(uuid),
  public.enrolled_in_session(uuid, uuid), public.enrolled_for_assessment(uuid, uuid) from anon;


-- ------------------------------------------------------------
-- 2. Teachers and student profiles.
--
-- "faculty read profiles" let every teacher read every row of
-- profiles: dates of birth, parents' phones, home addresses, for
-- all 514 students. It was always meant to be narrowed.
--
-- Now:
--  - a mentor reads their mentees' full profiles (already a policy:
--    "mentor reads their mentees"), because looking after a student
--    is what those details are for;
--  - a subject teacher sees only the class roster — id, name, USN —
--    through v_class_roster, and nothing else about the students.
-- ------------------------------------------------------------
drop policy if exists "faculty read profiles" on public.profiles;

-- Runs as its owner, so it can read the names it needs; the WHERE
-- clause is the access rule. Only sections the teacher teaches.
create or replace view public.v_class_roster as
select ss.section_id, p.id as student_id, p.full_name, p.usn
  from public.section_students ss
  join public.profiles p on p.id = ss.student_id
 where public.teaches_section(ss.section_id) or public.is_admin();

revoke all on public.v_class_roster from anon;
grant select on public.v_class_roster to authenticated;


-- ------------------------------------------------------------
-- 3. Mentors see mentees' attendance and published marks in
-- every subject. The views (v_student_attendance and
-- v_student_scorecard) run with the reader's permissions, so each
-- table they read needs a matching rule.
-- ------------------------------------------------------------
drop policy if exists "mentor reads mentees' section assignments" on public.faculty_assignments;
create policy "mentor reads mentees' section assignments" on public.faculty_assignments
  for select using (public.mentors_in_section(section_id));

drop policy if exists "mentor reads sessions of mentees' classes" on public.attendance_sessions;
create policy "mentor reads sessions of mentees' classes" on public.attendance_sessions
  for select using (public.mentors_in_assignment(assignment_id));

drop policy if exists "mentor reads mentees' attendance" on public.attendance_records;
create policy "mentor reads mentees' attendance" on public.attendance_records
  for select using (public.mentors(student_id));

drop policy if exists "mentor reads published assessments of mentees' classes" on public.assessments;
create policy "mentor reads published assessments of mentees' classes" on public.assessments
  for select using (published and public.mentors_in_assignment(assignment_id));

drop policy if exists "mentor reads mentees' published marks" on public.marks;
create policy "mentor reads mentees' published marks" on public.marks
  for select using (public.mentors(student_id) and exists (
    select 1 from public.assessments a where a.id = assessment_id and a.published
  ));


-- ------------------------------------------------------------
-- 6. A teaching assignment with history can't be deleted.
--
-- Attendance sessions and assessments cascaded on delete, so
-- removing a teacher from a class silently took the class's whole
-- record with it. Now the database refuses (23503). The timetable
-- still goes with the assignment: it is a plan, not a record.
-- ------------------------------------------------------------
alter table public.attendance_sessions
  drop constraint if exists attendance_sessions_assignment_id_fkey,
  add constraint attendance_sessions_assignment_id_fkey
    foreign key (assignment_id) references public.faculty_assignments (id) on delete restrict;

alter table public.assessments
  drop constraint if exists assessments_assignment_id_fkey,
  add constraint assessments_assignment_id_fkey
    foreign key (assignment_id) references public.faculty_assignments (id) on delete restrict;


-- ------------------------------------------------------------
-- 7. Writes in your own name, for your own class.
-- ------------------------------------------------------------

-- A session records who took it: that has to be the person saving it.
drop policy if exists "faculty manages own sessions" on public.attendance_sessions;
create policy "faculty manages own sessions" on public.attendance_sessions for all
  using (public.teaches_assignment(assignment_id))
  with check (public.teaches_assignment(assignment_id) and taken_by = auth.uid());

-- Only students actually in the class can be marked in it.
drop policy if exists "faculty manages attendance for own classes" on public.attendance_records;
create policy "faculty manages attendance for own classes" on public.attendance_records for all
  using (exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id and public.teaches_assignment(s.assignment_id)
  ))
  with check (exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id and public.teaches_assignment(s.assignment_id)
  ) and public.enrolled_in_session(session_id, student_id));

drop policy if exists "faculty manages marks for own assessments" on public.marks;
create policy "faculty manages marks for own assessments" on public.marks for all
  using (exists (
    select 1 from public.assessments a
    where a.id = assessment_id and public.teaches_assignment(a.assignment_id)
  ))
  with check (exists (
    select 1 from public.assessments a
    where a.id = assessment_id and public.teaches_assignment(a.assignment_id)
  ) and public.enrolled_for_assessment(assessment_id, student_id));

-- An alert is signed by whoever sends it.
drop policy if exists "mentor manages alerts for own mentees" on public.mentor_alerts;
create policy "mentor manages alerts for own mentees" on public.mentor_alerts for all
  using (public.mentors(student_id))
  with check (public.mentors(student_id) and mentor_id = auth.uid());

-- A decision on an edit request is signed by whoever makes it.
drop policy if exists "mentor decides" on public.profile_edit_requests;
create policy "mentor decides" on public.profile_edit_requests for update
  using (public.mentors(student_id))
  with check (public.mentors(student_id) and (decided_by is null or decided_by = auth.uid()));


-- ------------------------------------------------------------
-- 8. AI roadmaps: the student, their mentor, and the HOD.
-- ------------------------------------------------------------
drop policy if exists "admin/faculty reads ai data" on public.ai_roadmaps;
drop policy if exists "mentor or admin reads roadmaps" on public.ai_roadmaps;
create policy "mentor or admin reads roadmaps" on public.ai_roadmaps for select
  using (public.is_admin() or public.mentors(student_id));
