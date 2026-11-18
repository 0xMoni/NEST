-- ============================================================
-- Attendance as a spreadsheet, and the rules that keep the
-- numbers in it honest.
--
--  1. attendance_register(): one class's attendance, date by
--     date, for the teacher's (and the HOD's) Excel download.
--  2. section_attendance_summary(): every subject in a section,
--     for the HOD's Excel download.
--  3. Attendance records say who last changed them, and when.
--  4. No attendance for a date that hasn't happened yet.
--  5. No mark above the assessment's maximum.
--
-- Why functions and not plain queries from the page: the API
-- returns at most 1000 rows per request, and a term of one class
-- (60 students x 50 classes) is already 3000 attendance rows. A
-- function hands back one JSON document per class instead.
--
-- Both run as the caller (security invoker), so row-level
-- security still decides what they can read. The access check at
-- the top only turns "you can't see this" into a clear message
-- instead of an empty sheet.
--
-- Run after 20261116010000_tidy_up.sql. Safe to run more than once.
-- ============================================================


-- ------------------------------------------------------------
-- 1. One class's register.
--
-- Returns:
--   { class:    { assignment_id, subject_code, subject_name, section, faculty_name },
--     from, to,
--     sessions: [ { held_on, period }, ... ]              -- oldest first
--     students: [ { student_id, usn, name,
--                   marks: ['P','A',null,...],           -- one per session
--                   held, attended, percentage }, ... ] } -- by USN
--
-- A null mark means the student has no record for that class
-- (enrolled after it was held). Late and excused, if any old rows
-- have them, count as present, the same as v_student_attendance.
-- p_from / p_to are optional and inclusive.
-- ------------------------------------------------------------
create or replace function public.attendance_register(
  p_assignment_id uuid,
  p_from date default null,
  p_to   date default null
)
returns jsonb
language plpgsql stable security invoker set search_path = public
as $$
declare
  cls    record;
  result jsonb;
begin
  if not (public.teaches_assignment(p_assignment_id) or public.is_admin()) then
    raise exception using errcode = '42501',
      message = 'Only the teacher of this class or the HOD can export its attendance.';
  end if;

  select fa.id, fa.section_id, s.code, s.name,
         sec.dept || '-' || sec.semester || sec.name as section,
         p.full_name as faculty_name
    into cls
    from public.faculty_assignments fa
    join public.subjects s   on s.id = fa.subject_id
    join public.sections sec on sec.id = fa.section_id
    left join public.profiles p on p.id = fa.faculty_id
   where fa.id = p_assignment_id;

  if cls.id is null then
    raise exception using errcode = 'P0002', message = 'No such class.';
  end if;

  with sess as (
    select id, held_on, period,
           row_number() over (order by held_on, period) as n
      from public.attendance_sessions
     where assignment_id = p_assignment_id
       and (p_from is null or held_on >= p_from)
       and (p_to   is null or held_on <= p_to)
  ),
  grid as (
    select r.student_id, r.usn, r.full_name, sess.n,
           case when ar.status is null then null
                when ar.status = 'absent' then 'A'
                else 'P' end as mark
      from public.v_class_roster r
      cross join sess
      left join public.attendance_records ar
             on ar.session_id = sess.id and ar.student_id = r.student_id
     where r.section_id = cls.section_id
  ),
  per_student as (
    select student_id, usn, full_name,
           jsonb_agg(to_jsonb(mark) order by n) as marks,
           count(mark)                              as held,
           count(*) filter (where mark = 'P')       as attended
      from grid
     group by student_id, usn, full_name
  ),
  -- students with no sessions in range still belong on the sheet
  everyone as (
    select r.student_id, r.usn, r.full_name,
           coalesce(ps.marks, '[]'::jsonb) as marks,
           coalesce(ps.held, 0)     as held,
           coalesce(ps.attended, 0) as attended
      from public.v_class_roster r
      left join per_student ps on ps.student_id = r.student_id
     where r.section_id = cls.section_id
  )
  select jsonb_build_object(
    'class', jsonb_build_object(
      'assignment_id', cls.id,
      'subject_code',  cls.code,
      'subject_name',  cls.name,
      'section',       cls.section,
      'faculty_name',  cls.faculty_name),
    'from', p_from,
    'to',   p_to,
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('held_on', held_on, 'period', period) order by n) from sess), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(jsonb_build_object(
        'student_id', student_id,
        'usn',        usn,
        'name',       full_name,
        'marks',      marks,
        'held',       held,
        'attended',   attended,
        'percentage', case when held > 0 then round(100.0 * attended / held, 1) end
      ) order by usn nulls last, full_name) from everyone), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;


-- ------------------------------------------------------------
-- 2. A whole section at a glance, for the HOD.
--
-- Returns:
--   { section: { section_id, label },
--     classes:  [ { assignment_id, subject_code, subject_name, faculty_name, held }, ... ]
--     students: [ { student_id, usn, name,
--                   subjects: [ { held, attended, percentage } | null, ... ],  -- same order as classes
--                   held, attended, percentage }, ... ] }
-- ------------------------------------------------------------
create or replace function public.section_attendance_summary(p_section_id uuid)
returns jsonb
language plpgsql stable security invoker set search_path = public
as $$
declare
  label  text;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501',
      message = 'Only the HOD can export a whole section''s attendance.';
  end if;

  select dept || '-' || semester || name into label from public.sections where id = p_section_id;
  if label is null then
    raise exception using errcode = 'P0002', message = 'No such section.';
  end if;

  with classes as (
    select fa.id, s.code, s.name, p.full_name as faculty_name,
           (select count(*) from public.attendance_sessions x where x.assignment_id = fa.id) as held,
           row_number() over (order by s.code) as n
      from public.faculty_assignments fa
      join public.subjects s on s.id = fa.subject_id
      left join public.profiles p on p.id = fa.faculty_id
     where fa.section_id = p_section_id
  ),
  counts as (
    select ar.student_id, sess.assignment_id,
           count(*) as held,
           count(*) filter (where ar.status <> 'absent') as attended
      from public.attendance_records ar
      join public.attendance_sessions sess on sess.id = ar.session_id
     where sess.assignment_id in (select id from classes)
     group by ar.student_id, sess.assignment_id
  ),
  roster as (
    select student_id, usn, full_name from public.v_class_roster where section_id = p_section_id
  ),
  per_student as (
    select r.student_id, r.usn, r.full_name,
           jsonb_agg(case when c.held is null then null else jsonb_build_object(
             'held', c.held, 'attended', c.attended,
             'percentage', round(100.0 * c.attended / c.held, 1)) end order by cl.n) as subjects,
           coalesce(sum(c.held), 0)     as held,
           coalesce(sum(c.attended), 0) as attended
      from roster r
      cross join classes cl
      left join counts c on c.student_id = r.student_id and c.assignment_id = cl.id
     group by r.student_id, r.usn, r.full_name
  )
  select jsonb_build_object(
    'section', jsonb_build_object('section_id', p_section_id, 'label', label),
    'classes', coalesce((select jsonb_agg(jsonb_build_object(
        'assignment_id', id, 'subject_code', code, 'subject_name', name,
        'faculty_name', faculty_name, 'held', held) order by n) from classes), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(jsonb_build_object(
        'student_id', r.student_id, 'usn', r.usn, 'name', r.full_name,
        'subjects', coalesce(ps.subjects, '[]'::jsonb),
        'held', coalesce(ps.held, 0), 'attended', coalesce(ps.attended, 0),
        'percentage', case when ps.held > 0 then round(100.0 * ps.attended / ps.held, 1) end
      ) order by r.usn nulls last, r.full_name)
      from roster r left join per_student ps on ps.student_id = r.student_id), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.attendance_register(uuid, date, date), public.section_attendance_summary(uuid) from public, anon;
grant execute on function public.attendance_register(uuid, date, date), public.section_attendance_summary(uuid) to authenticated;


-- ------------------------------------------------------------
-- 3. Who changed a mark, and when.
--
-- Corrections are allowed (and should be), but a register that
-- goes to the office needs to say who changed what. The page saves
-- the whole class every time, so the stamp only moves when the
-- status actually changes. Existing rows are left blank.
-- ------------------------------------------------------------
alter table public.attendance_records
  add column if not exists marked_at timestamptz default now(),
  add column if not exists marked_by uuid references public.profiles on delete set null;

create or replace function public.stamp_attendance_record()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    new.marked_at := old.marked_at;
    new.marked_by := old.marked_by;
  else
    new.marked_at := now();
    new.marked_by := auth.uid();   -- null when the office's own scripts write
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_records_stamp on public.attendance_records;
create trigger attendance_records_stamp
  before insert or update on public.attendance_records
  for each row execute function public.stamp_attendance_record();


-- ------------------------------------------------------------
-- 4. Not in the future.
--
-- A class marked for next week is always a mistyped date, and it
-- would count toward everyone's percentage. "Today" is the
-- college's today (India), not the server's UTC date, which is a
-- day behind until 5:30 in the morning.
-- ------------------------------------------------------------
create or replace function public.prevent_future_attendance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.held_on > (now() at time zone 'Asia/Kolkata')::date then
    raise exception using errcode = '23514',
      message = 'Attendance can''t be marked for a date that hasn''t happened yet.';
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_sessions_not_future on public.attendance_sessions;
create trigger attendance_sessions_not_future
  before insert or update of held_on on public.attendance_sessions
  for each row execute function public.prevent_future_attendance();


-- ------------------------------------------------------------
-- 5. A mark can't be more than the maximum.
--
-- A typo of 250 out of 25 would show as 1000% on a scorecard. A
-- check constraint can't look at another table, so a trigger on
-- each side: saving a mark, and lowering an assessment's maximum
-- below marks already given.
-- ------------------------------------------------------------
create or replace function public.check_mark_within_max()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  top numeric;
begin
  if new.scored is null then return new; end if;
  select max_marks into top from public.assessments where id = new.assessment_id;
  if new.scored > top then
    raise exception using errcode = '23514',
      message = format('A mark of %s is more than the maximum of %s.', trim_scale(new.scored), trim_scale(top));
  end if;
  return new;
end;
$$;

drop trigger if exists marks_within_max on public.marks;
create trigger marks_within_max
  before insert or update of scored, assessment_id on public.marks
  for each row execute function public.check_mark_within_max();

create or replace function public.check_max_above_marks()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.marks where assessment_id = new.id and scored > new.max_marks) then
    raise exception using errcode = '23514',
      message = 'Some students already have more than that. Correct their marks first.';
  end if;
  return new;
end;
$$;

drop trigger if exists assessments_max_above_marks on public.assessments;
create trigger assessments_max_above_marks
  before update of max_marks on public.assessments
  for each row execute function public.check_max_above_marks();
