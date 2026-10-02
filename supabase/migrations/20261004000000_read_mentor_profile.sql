-- ============================================================
-- A student could not see who their mentor is.
--
-- "read own profile" allows auth.uid() = id and nothing else, so
-- embedding the mentor's name returned null and every screen said
-- "no mentor assigned yet". The mentorship row was readable; the
-- person on the other end of it was not.
--
-- Narrow on purpose: a student may read the profile of their own
-- mentor, and of faculty who teach a section they are in. Not
-- every profile, and not each other's.
-- ============================================================

create policy "student reads their mentor" on public.profiles
  for select using (
    exists (
      select 1 from public.mentorships m
      where m.mentor_id = profiles.id and m.student_id = auth.uid()
    )
  );

create policy "student reads faculty who teach them" on public.profiles
  for select using (
    exists (
      select 1
      from public.faculty_assignments fa
      join public.section_students ss on ss.section_id = fa.section_id
      where fa.faculty_id = profiles.id and ss.student_id = auth.uid()
    )
  );

-- The mirror of the first: a mentor needs their mentee's name to act on a
-- request. "faculty read profiles" already covers it, but stating it keeps
-- the pair legible side by side.
create policy "mentor reads their mentees" on public.profiles
  for select using (
    exists (
      select 1 from public.mentorships m
      where m.student_id = profiles.id and m.mentor_id = auth.uid()
    )
  );
