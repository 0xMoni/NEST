-- ============================================================
-- Academic terms.
--
-- A section was just "CSE 5 B", reused every year, so next year's
-- 5B would have inherited this year's timetable, teachers and
-- attendance. Now every section belongs to a term, and one term is
-- the current one. Pages show the current term; the earlier ones
-- keep their sections, teachers, attendance and marks as they were.
--
--  1. academic_terms, one of them current.
--  2. sections.term_id. Sections that exist now go into a first term.
--     A new section goes into the current term unless told otherwise.
--  3. One section per student per term (was: ever).
--  4. Students see their current term: the helper the student rules
--     use, studies_in_section(), now means "is in this section, and
--     it is in the current term". Mentors and the HOD still see
--     every term.
--  5. promote_term(): next term's sections, one semester up, with
--     the same students, in one step.
--
-- Run after 20261119000000_review_fixes.sql. Safe to run more than
-- once.
-- ============================================================

do $$
declare later boolean;
begin
  if to_regclass('private.applied_migrations') is null then
    raise exception 'Run 20261119000000_review_fixes.sql first.';
  end if;
  execute 'select exists (select 1 from private.applied_migrations where version > $1)'
     into later using '20261120000000';
  if later then
    raise exception 'A later migration is already applied; running 20261120000000 again would undo it.';
  end if;
end $$;


-- ------------------------------------------------------------
-- 1. Terms.
-- ------------------------------------------------------------
create table if not exists public.academic_terms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,              -- '2026–27 odd semester'
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on > starts_on)
);

-- at most one current term
create unique index if not exists academic_terms_one_current
  on public.academic_terms (is_current) where is_current;

alter table public.academic_terms enable row level security;

drop policy if exists "signed-in users read terms" on public.academic_terms;
create policy "signed-in users read terms" on public.academic_terms for select
  using ((select auth.uid()) is not null);
drop policy if exists "admin writes terms" on public.academic_terms;
create policy "admin writes terms" on public.academic_terms for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.academic_terms from anon;
grant select, insert, update, delete on public.academic_terms to authenticated;

-- The term everything so far belongs to. The dates are a guess at
-- the odd semester; the HOD can correct them on the Structure page.
insert into public.academic_terms (name, starts_on, ends_on, is_current)
select '2026–27 odd semester', date '2026-08-01', date '2027-01-31', true
 where not exists (select 1 from public.academic_terms);

create or replace function public.current_term()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.academic_terms where is_current;
$$;


-- ------------------------------------------------------------
-- 2. Sections belong to a term.
-- ------------------------------------------------------------
alter table public.sections
  add column if not exists term_id uuid references public.academic_terms (id) on delete restrict;

update public.sections set term_id = public.current_term() where term_id is null;

-- "Add section" and the import scripts don't name a term: they mean
-- the current one.
create or replace function public.section_default_term()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.term_id is null then
    new.term_id := public.current_term();
  end if;
  if new.term_id is null then
    raise exception 'There is no current term. Make one current on the Structure page first.';
  end if;
  return new;
end;
$$;

drop trigger if exists sections_default_term on public.sections;
create trigger sections_default_term
  before insert on public.sections
  for each row execute function public.section_default_term();

alter table public.sections alter column term_id set not null;

-- CSE 5 B once per term, not once ever.
alter table public.sections drop constraint if exists sections_dept_semester_name_key;
create unique index if not exists sections_term_dept_semester_name
  on public.sections (term_id, dept, semester, name);
create index if not exists sections_term_id_idx on public.sections (term_id);


-- ------------------------------------------------------------
-- 3. One section per student per term.
-- ------------------------------------------------------------
create or replace function public.one_section_per_student()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1
      from public.section_students ss
      join public.sections s on s.id = ss.section_id
      join public.sections t on t.id = new.section_id
     where ss.student_id = new.student_id
       and ss.section_id <> new.section_id
       and s.term_id = t.term_id
  ) then
    raise exception using errcode = '23505',
      message = 'This student is already in another section this term. Remove them from it first.';
  end if;
  return new;
end;
$$;


-- ------------------------------------------------------------
-- 4. Students see the current term.
--
-- Every student rule (their timetable, teachers, classes, published
-- assessments) asks studies_in_section(). Limiting it to the current
-- term keeps last year's 5B out of this year's pages without
-- touching each rule. Teachers' and mentors' helpers are unchanged.
-- ------------------------------------------------------------
create or replace function public.studies_in_section(s_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.section_students ss
      join public.sections s on s.id = ss.section_id
      join public.academic_terms t on t.id = s.term_id
     where ss.section_id = s_id
       and ss.student_id = auth.uid()
       and t.is_current
  );
$$;


-- ------------------------------------------------------------
-- 4b. The two student views say which term each row is from, so a
-- mentor's or the HOD's page can show this term's figures. Same
-- columns as before, with term_id added at the end.
-- ------------------------------------------------------------
create or replace view public.v_student_attendance with (security_invoker = on) as
select
  r.student_id,
  fa.subject_id,
  s.code  as subject_code,
  s.name  as subject_name,
  fa.section_id,
  count(*)                                          as held,
  count(*) filter (where r.status in ('present','late','excused')) as attended,
  round(100.0 * count(*) filter (where r.status in ('present','late','excused')) / nullif(count(*),0), 1) as percentage,
  round(100.0 * count(*) filter (where r.status in ('present','late','excused')) / nullif(count(*),0), 1) < 75 as short,
  sec.term_id
from public.attendance_records r
join public.attendance_sessions sess on sess.id = r.session_id
join public.faculty_assignments fa   on fa.id = sess.assignment_id
join public.subjects s               on s.id = fa.subject_id
join public.sections sec             on sec.id = fa.section_id
group by r.student_id, fa.subject_id, s.code, s.name, fa.section_id, sec.term_id;

create or replace view public.v_student_scorecard with (security_invoker = on) as
select
  m.student_id,
  fa.subject_id,
  s.code as subject_code,
  s.name as subject_name,
  a.id   as assessment_id,
  a.title,
  m.scored,
  a.max_marks,
  round(100.0 * m.scored / nullif(a.max_marks,0), 1) as percentage,
  sec.term_id
from public.marks m
join public.assessments a          on a.id = m.assessment_id
join public.faculty_assignments fa on fa.id = a.assignment_id
join public.subjects s             on s.id = fa.subject_id
join public.sections sec           on sec.id = fa.section_id
where a.published;


-- ------------------------------------------------------------
-- 5. Promotion.
--
-- For each section of p_from below semester 8, the same section one
-- semester up in p_to, with the same students. Final-semester
-- sections graduate and are not carried over. Teachers, subjects
-- and the timetable are per semester, so they are not copied; the
-- HOD sets them for the new term. Runs as the caller, so only the
-- HOD's write rules let it work. Returns how many students moved.
-- ------------------------------------------------------------
create or replace function public.promote_term(p_from uuid, p_to uuid)
returns integer language plpgsql security invoker set search_path = public as $$
declare
  moved integer := 0;
  n integer;
  src record;
  dest uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Only the HOD can promote a term.';
  end if;
  if p_from = p_to then
    raise exception 'Pick two different terms.';
  end if;

  for src in
    select id, dept, semester, name from public.sections
     where term_id = p_from and semester < 8
  loop
    insert into public.sections (term_id, dept, semester, name)
    values (p_to, src.dept, src.semester + 1, src.name)
    on conflict (term_id, dept, semester, name) do update set name = excluded.name
    returning id into dest;

    insert into public.section_students (section_id, student_id)
    select dest, ss.student_id
      from public.section_students ss
     where ss.section_id = src.id
       -- already placed somewhere in the new term: leave them there
       and not exists (
         select 1 from public.section_students x
           join public.sections s on s.id = x.section_id
          where x.student_id = ss.student_id and s.term_id = p_to
       )
    on conflict do nothing;
    get diagnostics n = row_count;
    moved := moved + n;
  end loop;

  return moved;
end;
$$;

-- Switching terms is two writes (the old one off, then the new one
-- on), in that order, or the one-current rule refuses the first.
create or replace function public.make_term_current(p_term uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Only the HOD can change the current term.';
  end if;
  update public.academic_terms set is_current = false where is_current and id <> p_term;
  update public.academic_terms set is_current = true where id = p_term;
end;
$$;

revoke all on function public.current_term(), public.promote_term(uuid, uuid), public.make_term_current(uuid) from public, anon;
grant execute on function public.current_term(), public.promote_term(uuid, uuid), public.make_term_current(uuid) to authenticated;


insert into private.applied_migrations (version) values ('20261120000000')
on conflict (version) do nothing;
