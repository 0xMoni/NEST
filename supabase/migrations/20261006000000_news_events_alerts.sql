-- ============================================================
-- Backend for the four features designed in mockups/data.js:
-- newsletters, events, NPTEL, and mentor alerts.
--
-- Shapes follow that file closely, with two differences. Dates
-- that were display strings ("Sat 10 Oct") become real dates, so
-- they can be sorted and filtered. And anything the mock computed
-- in JavaScript — a week's status, the best-of-N score — is
-- derived here instead, so one answer exists rather than one per
-- page that reimplements it.
-- ============================================================

-- ---------------- newsletters ----------------
-- Posted by teachers only, per her note in data.js.

create table public.newsletters (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles on delete cascade,
  subject_id   uuid references public.subjects on delete set null,
  scope        text,                       -- when it is not about one subject: "AI & DS department"
  title        text not null,
  summary      text,                       -- the one-line "Sat 10 Oct · 10:00 AM · Room 304"
  body         text[] not null default '{}',  -- paragraphs, in order
  published_at timestamptz not null default now()
);
create index on public.newsletters (published_at desc);

-- ---------------- events ----------------

create type public.event_kind as enum ('hackathon', 'workshop', 'talk');

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  kind        public.event_kind not null,
  held_on     date not null,
  title       text not null,
  description text,
  venue       text,
  time_text   text,        -- "36 hours, from 9:00 AM" does not fit a time column
  team_text   text,        -- "Teams of 4", "Open to Sem 5+"
  closing_note text,       -- "Registrations close Mon 12 Oct", "12 seats left"
  link        text,
  created_by  uuid references public.profiles on delete set null
);
create index on public.events (held_on);

-- ---------------- NPTEL ----------------
-- A course and its weeks are the same for everyone taking it. The NPTEL id
-- and the exam booking belong to the student, which is why they are split.

create table public.nptel_courses (
  id        uuid primary key default gen_random_uuid(),
  title     text not null,
  institute text not null,
  run_label text,                       -- "Jul–Oct 2026"
  best_of   smallint not null default 8 -- assignment score counts the best N weeks
);

create table public.nptel_weeks (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.nptel_courses on delete cascade,
  week_no     smallint not null,
  title       text not null,
  due_on      date not null,
  video_count smallint not null default 0,
  unique (course_id, week_no)
);

create table public.nptel_enrolments (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.nptel_courses on delete cascade,
  student_id   uuid not null references public.profiles on delete cascade,
  nptel_id     text,                    -- NPTEL26CS43S5523014, per student per course
  exam_applied boolean not null default false,
  exam_on      date,
  exam_slot    text,
  exam_centre  text,
  exam_closes  date,                    -- when registration shuts, if not applied
  unique (course_id, student_id)
);
create index on public.nptel_enrolments (student_id);

create table public.nptel_progress (
  enrolment_id    uuid not null references public.nptel_enrolments on delete cascade,
  week_id         uuid not null references public.nptel_weeks on delete cascade,
  videos_watched  smallint not null default 0,
  -- null means the deadline passed with nothing submitted; a number is the
  -- score out of 100. Whether a week is open or still upcoming is decided by
  -- its due date, not stored.
  score           smallint check (score between 0 and 100),
  primary key (enrolment_id, week_id)
);

-- ---------------- mentor alerts ----------------

create type public.alert_kind as enum ('task', 'meet');

create table public.mentor_alerts (
  id              uuid primary key default gen_random_uuid(),
  mentor_id       uuid not null references public.profiles on delete cascade,
  student_id      uuid not null references public.profiles on delete cascade,
  kind            public.alert_kind not null default 'task',
  urgent          boolean not null default false,
  title           text not null,
  message         text,
  due_text        text,                 -- "Wed 7 Oct · 3:30 PM", "Due 10 Oct"
  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz
);
create index on public.mentor_alerts (student_id, created_at desc);

-- ============================================================
-- Derived views. The mock computed these in each page; doing it
-- once here means every screen agrees.
-- ============================================================

-- A week, with the status the UI shows: upcoming, open, submitted or missed.
create view public.v_nptel_week_status with (security_invoker = on) as
select
  e.id            as enrolment_id,
  e.student_id,
  e.course_id,
  w.id            as week_id,
  w.week_no,
  w.title,
  w.due_on,
  w.video_count,
  coalesce(p.videos_watched, 0) as videos_watched,
  p.score,
  case
    when w.due_on > current_date + 7       then 'upcoming'
    when w.due_on >= current_date          then 'open'
    when p.score is not null               then 'submitted'
    else 'missed'
  end as status
from public.nptel_enrolments e
join public.nptel_weeks w on w.course_id = e.course_id
left join public.nptel_progress p on p.enrolment_id = e.id and p.week_id = w.id;

-- Assignment marks out of 25, from the best `best_of` closed weeks. A missed
-- week counts as zero; weeks still open cannot pull the number down.
create view public.v_nptel_course_score with (security_invoker = on) as
select
  s.enrolment_id,
  s.student_id,
  s.course_id,
  c.title,
  c.institute,
  c.run_label,
  c.best_of,
  sum(s.videos_watched) filter (where s.status <> 'upcoming') as videos_watched,
  sum(s.video_count)    filter (where s.status <> 'upcoming') as videos_total,
  round(
    coalesce((
      select sum(x.sc) from (
        select coalesce(s2.score, 0) as sc
        from public.v_nptel_week_status s2
        where s2.enrolment_id = s.enrolment_id
          and s2.status in ('submitted', 'missed')
        order by coalesce(s2.score, 0) desc
        limit c.best_of
      ) x
    ), 0)::numeric / (c.best_of * 100) * 25,
  1) as assignment_score
from public.v_nptel_week_status s
join public.nptel_courses c on c.id = s.course_id
group by s.enrolment_id, s.student_id, s.course_id, c.title, c.institute, c.run_label, c.best_of;

-- ============================================================
-- Policies
-- ============================================================

alter table public.newsletters      enable row level security;
alter table public.events           enable row level security;
alter table public.nptel_courses    enable row level security;
alter table public.nptel_weeks      enable row level security;
alter table public.nptel_enrolments enable row level security;
alter table public.nptel_progress   enable row level security;
alter table public.mentor_alerts    enable row level security;

-- newsletters and events: everyone signed in reads, staff write
create policy "anyone signed in reads newsletters" on public.newsletters
  for select using (auth.uid() is not null);
create policy "author manages own newsletter" on public.newsletters
  for all using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "admin manages newsletters" on public.newsletters
  for all using (public.is_admin()) with check (public.is_admin());

create policy "anyone signed in reads events" on public.events
  for select using (auth.uid() is not null);
create policy "staff manage events" on public.events
  for all using (public.is_admin() or public.current_role_is('faculty'))
  with check (public.is_admin() or public.current_role_is('faculty'));

-- the course catalogue is shared; the office maintains it from the SPOC sheet
create policy "anyone signed in reads courses" on public.nptel_courses
  for select using (auth.uid() is not null);
create policy "admin manages courses" on public.nptel_courses
  for all using (public.is_admin()) with check (public.is_admin());
create policy "anyone signed in reads weeks" on public.nptel_weeks
  for select using (auth.uid() is not null);
create policy "admin manages weeks" on public.nptel_weeks
  for all using (public.is_admin()) with check (public.is_admin());

-- enrolment and progress are personal
create policy "student reads own enrolment" on public.nptel_enrolments
  for select using (student_id = auth.uid());
create policy "mentor reads mentee enrolment" on public.nptel_enrolments
  for select using (public.mentors(student_id));
create policy "admin manages enrolments" on public.nptel_enrolments
  for all using (public.is_admin()) with check (public.is_admin());

create policy "student reads own progress" on public.nptel_progress
  for select using (exists (
    select 1 from public.nptel_enrolments e where e.id = enrolment_id and e.student_id = auth.uid()));
create policy "mentor reads mentee progress" on public.nptel_progress
  for select using (exists (
    select 1 from public.nptel_enrolments e where e.id = enrolment_id and public.mentors(e.student_id)));
create policy "admin manages progress" on public.nptel_progress
  for all using (public.is_admin()) with check (public.is_admin());

-- alerts: a mentor writes them, the student reads and acknowledges
create policy "student reads own alerts" on public.mentor_alerts
  for select using (student_id = auth.uid());
create policy "student acknowledges own alert" on public.mentor_alerts
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "mentor manages alerts for own mentees" on public.mentor_alerts
  for all using (public.mentors(student_id)) with check (public.mentors(student_id));
create policy "admin reads alerts" on public.mentor_alerts
  for select using (public.is_admin());
