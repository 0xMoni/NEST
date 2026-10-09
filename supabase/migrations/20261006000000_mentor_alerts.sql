-- ============================================================
-- Mentor alerts.
--
-- A mentor leaves a student something to do or a time to meet;
-- the student sees it until they acknowledge it. Shape follows
-- mockups/data.js, where this was { kind, urgent, t, m, when, due }.
--
-- `due_text` stays free text on purpose. "Wed 7 Oct · 3:30 PM"
-- and "before the lab exam" are both things a mentor writes, and
-- only one of them fits a timestamp.
-- ============================================================

do $$ begin
  create type public.alert_kind as enum ('task', 'meet');
exception when duplicate_object then null;
end $$;

create table if not exists public.mentor_alerts (
  id              uuid primary key default gen_random_uuid(),
  mentor_id       uuid not null references public.profiles on delete cascade,
  student_id      uuid not null references public.profiles on delete cascade,
  kind            public.alert_kind not null default 'task',
  urgent          boolean not null default false,
  title           text not null,
  message         text,
  due_text        text,
  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz
);
create index if not exists mentor_alerts_student_id_created_at_idx
  on public.mentor_alerts (student_id, created_at desc);

-- ============================================================
-- Policies: a mentor writes them, the student reads and acknowledges.
-- ============================================================

alter table public.mentor_alerts enable row level security;

drop policy if exists "student reads own alerts" on public.mentor_alerts;
create policy "student reads own alerts" on public.mentor_alerts
  for select using (student_id = auth.uid());
drop policy if exists "student acknowledges own alert" on public.mentor_alerts;
create policy "student acknowledges own alert" on public.mentor_alerts
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());
drop policy if exists "mentor manages alerts for own mentees" on public.mentor_alerts;
create policy "mentor manages alerts for own mentees" on public.mentor_alerts
  for all using (public.mentors(student_id)) with check (public.mentors(student_id));
drop policy if exists "admin reads alerts" on public.mentor_alerts;
create policy "admin reads alerts" on public.mentor_alerts
  for select using (public.is_admin());
