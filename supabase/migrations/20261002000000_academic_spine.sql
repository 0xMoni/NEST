-- ============================================================
-- The academic spine: sections, subjects, who teaches what, the
-- timetable, attendance and marks.
--
-- Faculty access flows from one row — faculty_assignments — which
-- pairs a teacher with a subject and a section. Every faculty
-- policy below traces back to it, so there is one place to get
-- right rather than a dozen.
-- ============================================================

-- ---------- helpers ----------
-- security definer so a policy can read these tables without being
-- blocked by the policies it is in the middle of evaluating.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.teaches_assignment(a_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.faculty_assignments
    where id = a_id and faculty_id = auth.uid()
  );
$$;

create or replace function public.teaches_section(s_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.faculty_assignments
    where section_id = s_id and faculty_id = auth.uid()
  );
$$;

create or replace function public.studies_in_section(s_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.section_students
    where section_id = s_id and student_id = auth.uid()
  );
$$;

-- ---------- structure ----------

create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  semester   smallint not null check (semester between 1 and 8),
  credits    smallint not null default 4
);

create table public.sections (
  id         uuid primary key default gen_random_uuid(),
  dept       text not null,
  semester   smallint not null check (semester between 1 and 8),
  name       text not null,                       -- 'A', 'B', 'C'
  unique (dept, semester, name)
);

create table public.section_students (
  section_id uuid not null references public.sections on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  primary key (section_id, student_id)
);

create table public.faculty_assignments (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections on delete cascade,
  subject_id uuid not null references public.subjects on delete restrict,
  faculty_id uuid not null references public.profiles on delete restrict,
  unique (section_id, subject_id)                 -- one teacher per subject per section
);
create index on public.faculty_assignments (faculty_id);

create table public.timetable_slots (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.faculty_assignments on delete cascade,
  day_of_week   smallint not null check (day_of_week between 1 and 6),
  period        smallint not null check (period between 1 and 8),
  unique (assignment_id, day_of_week, period)
);

-- ---------- attendance ----------

create table public.attendance_sessions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.faculty_assignments on delete cascade,
  held_on       date not null,
  period        smallint not null check (period between 1 and 8),
  taken_by      uuid not null references public.profiles on delete restrict,
  created_at    timestamptz not null default now(),
  -- marking the same class twice corrects it rather than duplicating it
  unique (assignment_id, held_on, period)
);

create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');

create table public.attendance_records (
  session_id uuid not null references public.attendance_sessions on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  status     public.attendance_status not null default 'present',
  primary key (session_id, student_id)
);
create index on public.attendance_records (student_id);

-- ---------- marks ----------

create table public.assessments (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.faculty_assignments on delete cascade,
  title         text not null,                    -- 'IAT 1', 'IAT 2'
  max_marks     numeric(5,2) not null check (max_marks > 0),
  held_on       date,
  published     boolean not null default false,   -- students see nothing until this flips
  created_at    timestamptz not null default now()
);

create table public.marks (
  assessment_id uuid not null references public.assessments on delete cascade,
  student_id    uuid not null references public.profiles on delete cascade,
  scored        numeric(5,2) check (scored >= 0),
  primary key (assessment_id, student_id)
);
create index on public.marks (student_id);

-- ---------- mentorship ----------

create table public.mentorships (
  mentor_id  uuid not null references public.profiles on delete cascade,
  student_id uuid not null references public.profiles on delete cascade primary key
);
create index on public.mentorships (mentor_id);

-- ============================================================
-- Row level security
-- ============================================================

alter table public.subjects            enable row level security;
alter table public.sections            enable row level security;
alter table public.section_students    enable row level security;
alter table public.faculty_assignments enable row level security;
alter table public.timetable_slots     enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records  enable row level security;
alter table public.assessments         enable row level security;
alter table public.marks               enable row level security;
alter table public.mentorships         enable row level security;

-- reference data: readable by anyone signed in, written only by admin
create policy "read subjects" on public.subjects for select using (auth.uid() is not null);
create policy "admin writes subjects" on public.subjects for all using (public.is_admin()) with check (public.is_admin());
create policy "read sections" on public.sections for select using (auth.uid() is not null);
create policy "admin writes sections" on public.sections for all using (public.is_admin()) with check (public.is_admin());

-- enrolment
create policy "student reads own enrolment" on public.section_students for select
  using (student_id = auth.uid());
create policy "faculty reads their sections" on public.section_students for select
  using (public.teaches_section(section_id));
create policy "admin writes enrolment" on public.section_students for all
  using (public.is_admin()) with check (public.is_admin());

-- assignments
create policy "faculty reads own assignments" on public.faculty_assignments for select
  using (faculty_id = auth.uid());
create policy "student reads their section's assignments" on public.faculty_assignments for select
  using (public.studies_in_section(section_id));
create policy "admin writes assignments" on public.faculty_assignments for all
  using (public.is_admin()) with check (public.is_admin());

-- timetable
create policy "read timetable for your own classes" on public.timetable_slots for select
  using (
    public.teaches_assignment(assignment_id)
    or exists (
      select 1 from public.faculty_assignments fa
      where fa.id = assignment_id and public.studies_in_section(fa.section_id)
    )
  );
create policy "admin writes timetable" on public.timetable_slots for all
  using (public.is_admin()) with check (public.is_admin());

-- attendance: faculty own the classes they teach, students read their own record
create policy "faculty manages own sessions" on public.attendance_sessions for all
  using (public.teaches_assignment(assignment_id))
  with check (public.teaches_assignment(assignment_id));
create policy "student reads sessions of their section" on public.attendance_sessions for select
  using (exists (
    select 1 from public.faculty_assignments fa
    where fa.id = assignment_id and public.studies_in_section(fa.section_id)
  ));
create policy "admin reads sessions" on public.attendance_sessions for select using (public.is_admin());

create policy "student reads own attendance" on public.attendance_records for select
  using (student_id = auth.uid());
create policy "faculty manages attendance for own classes" on public.attendance_records for all
  using (exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id and public.teaches_assignment(s.assignment_id)
  ))
  with check (exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id and public.teaches_assignment(s.assignment_id)
  ));
create policy "admin reads attendance" on public.attendance_records for select using (public.is_admin());

-- marks: students see nothing until the assessment is published
create policy "faculty manages own assessments" on public.assessments for all
  using (public.teaches_assignment(assignment_id))
  with check (public.teaches_assignment(assignment_id));
create policy "student reads published assessments" on public.assessments for select
  using (published and exists (
    select 1 from public.faculty_assignments fa
    where fa.id = assignment_id and public.studies_in_section(fa.section_id)
  ));
create policy "admin reads assessments" on public.assessments for select using (public.is_admin());

create policy "student reads own published marks" on public.marks for select
  using (student_id = auth.uid() and exists (
    select 1 from public.assessments a where a.id = assessment_id and a.published
  ));
create policy "faculty manages marks for own assessments" on public.marks for all
  using (exists (
    select 1 from public.assessments a
    where a.id = assessment_id and public.teaches_assignment(a.assignment_id)
  ))
  with check (exists (
    select 1 from public.assessments a
    where a.id = assessment_id and public.teaches_assignment(a.assignment_id)
  ));
create policy "admin reads marks" on public.marks for select using (public.is_admin());

-- mentorship
create policy "student reads own mentor" on public.mentorships for select
  using (student_id = auth.uid());
create policy "mentor reads own mentees" on public.mentorships for select
  using (mentor_id = auth.uid());
create policy "admin writes mentorships" on public.mentorships for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Derived numbers.
--
-- Percentages are calculated, never stored. Store them and a
-- corrected absence leaves a stale figure on someone's screen.
-- security_invoker keeps the caller's row-level security in force,
-- so a view cannot become a way around the policies above.
-- ============================================================

create view public.v_student_attendance with (security_invoker = on) as
select
  r.student_id,
  fa.subject_id,
  s.code  as subject_code,
  s.name  as subject_name,
  fa.section_id,
  count(*)                                          as held,
  count(*) filter (where r.status in ('present','late','excused')) as attended,
  round(100.0 * count(*) filter (where r.status in ('present','late','excused')) / nullif(count(*),0), 1) as percentage,
  round(100.0 * count(*) filter (where r.status in ('present','late','excused')) / nullif(count(*),0), 1) < 75 as short
from public.attendance_records r
join public.attendance_sessions sess on sess.id = r.session_id
join public.faculty_assignments fa   on fa.id = sess.assignment_id
join public.subjects s               on s.id = fa.subject_id
group by r.student_id, fa.subject_id, s.code, s.name, fa.section_id;

create view public.v_student_scorecard with (security_invoker = on) as
select
  m.student_id,
  fa.subject_id,
  s.code as subject_code,
  s.name as subject_name,
  a.id   as assessment_id,
  a.title,
  m.scored,
  a.max_marks,
  round(100.0 * m.scored / nullif(a.max_marks,0), 1) as percentage
from public.marks m
join public.assessments a          on a.id = m.assessment_id
join public.faculty_assignments fa on fa.id = a.assignment_id
join public.subjects s             on s.id = fa.subject_id
where a.published;
