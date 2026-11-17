-- A mentor can see the attendance of their own mentees in every subject,
-- not just the classes they teach themselves. Read-only: nothing here lets a
-- mentor change another teacher's attendance.
--
-- The helpers are security definer so the policies below do not trip over
-- row-level security on mentorships / section_students.

create or replace function public.mentors_student(s_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.mentorships
    where student_id = s_id and mentor_id = auth.uid()
  );
$$;

create or replace function public.mentors_someone_in_section(sec_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.section_students ss
    join public.mentorships m on m.student_id = ss.student_id
    where ss.section_id = sec_id and m.mentor_id = auth.uid()
  );
$$;

drop policy if exists "mentor reads mentee attendance" on public.attendance_records;
create policy "mentor reads mentee attendance" on public.attendance_records for select
  using (public.mentors_student(student_id));

drop policy if exists "mentor reads mentee sessions" on public.attendance_sessions;
create policy "mentor reads mentee sessions" on public.attendance_sessions for select
  using (exists (
    select 1 from public.faculty_assignments fa
    where fa.id = assignment_id and public.mentors_someone_in_section(fa.section_id)
  ));

drop policy if exists "mentor reads mentee assignments" on public.faculty_assignments;
create policy "mentor reads mentee assignments" on public.faculty_assignments for select
  using (public.mentors_someone_in_section(section_id));
