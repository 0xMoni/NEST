-- ============================================================
-- What Supabase's advisor flagged on 18 Nov 2026.
--
--  1. "Security Definer View" on v_class_roster, v_my_teachers and
--     v_my_mentor. They ran as their owner on purpose: each shows a
--     few columns of profiles that the reader's own access could
--     not reach, and each filtered by who is signed in. Safe as
--     written, but a view that bypasses row-level security is easy
--     to get wrong later, so the advisor flags every one. The
--     owner's access now sits in functions in a `private` schema,
--     which the API does not expose, and the views are ordinary
--     (security_invoker) views over them. Same names, same columns,
--     same rule about who sees which rows; the pages don't change.
--
--  2. "Auth RLS Initialization Plan". Policies that call auth.uid()
--     or is_admin() directly run them once per row. Written as
--     (select auth.uid()) they run once per query. Every policy in
--     public is rewritten that way; what each one allows is the same.
--
-- Run after 20261118000000_role_from_app_metadata.sql. Safe to run
-- more than once.
-- ============================================================


-- ------------------------------------------------------------
-- 1. The three views.
-- ------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Name and USN for sections the signed-in teacher teaches (or the HOD).
create or replace function private.class_roster()
returns table (section_id uuid, student_id uuid, full_name text, usn text)
language sql stable security definer set search_path = public as $$
  select ss.section_id, p.id, p.full_name, p.usn
    from public.section_students ss
    join public.profiles p on p.id = ss.student_id
   where public.teaches_section(ss.section_id) or public.is_admin();
$$;

-- Who teaches each subject in the signed-in student's section.
create or replace function private.my_teachers()
returns table (assignment_id uuid, section_id uuid, subject_id uuid,
               subject_code text, subject_name text, faculty_name text)
language sql stable security definer set search_path = public as $$
  select fa.id, fa.section_id, fa.subject_id, s.code, s.name, p.full_name
    from public.faculty_assignments fa
    join public.subjects s on s.id = fa.subject_id
    join public.profiles p on p.id = fa.faculty_id
   where public.studies_in_section(fa.section_id);
$$;

-- The signed-in student's mentor: what goes on the contact card.
create or replace function private.my_mentor()
returns table (student_id uuid, mentor_id uuid, full_name text, designation text,
               email text, phone text, cabin text, office_hours text)
language sql stable security definer set search_path = public as $$
  select m.student_id, p.id, p.full_name, p.designation, p.email, p.phone, p.cabin, p.office_hours
    from public.mentorships m
    join public.profiles p on p.id = m.mentor_id
   where m.student_id = auth.uid();
$$;

revoke all on function private.class_roster(), private.my_teachers(), private.my_mentor() from public, anon;
grant execute on function private.class_roster(), private.my_teachers(), private.my_mentor() to authenticated;

create or replace view public.v_class_roster with (security_invoker = on) as
  select * from private.class_roster();
create or replace view public.v_my_teachers with (security_invoker = on) as
  select * from private.my_teachers();
create or replace view public.v_my_mentor with (security_invoker = on) as
  select * from private.my_mentor();

revoke all on public.v_class_roster, public.v_my_teachers, public.v_my_mentor from anon;
grant select on public.v_class_roster, public.v_my_teachers, public.v_my_mentor to authenticated;


-- ------------------------------------------------------------
-- 2. Once per query, not once per row.
--
-- Rewrites each policy's own expression rather than restating 37
-- policies by hand, so a policy made in the dashboard is covered
-- too, and running this twice changes nothing the second time.
-- ------------------------------------------------------------
do $$
declare
  pol record;
  q text;
  c text;
  stmt text;
begin
  set local search_path = public;
  for pol in
    select tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(auth\.uid\(\)|is_admin\(\))'
  loop
    q := pol.qual;
    c := pol.with_check;
    if q is not null and q !~* 'select auth\.uid\(\)' then q := replace(q, 'auth.uid()', '(select auth.uid())'); end if;
    if c is not null and c !~* 'select auth\.uid\(\)' then c := replace(c, 'auth.uid()', '(select auth.uid())'); end if;
    if q is not null and q !~* 'select (public\.)?is_admin\(\)' then q := regexp_replace(q, '(public\.)?is_admin\(\)', '(select public.is_admin())', 'g'); end if;
    if c is not null and c !~* 'select (public\.)?is_admin\(\)' then c := regexp_replace(c, '(public\.)?is_admin\(\)', '(select public.is_admin())', 'g'); end if;
    if q is not distinct from pol.qual and c is not distinct from pol.with_check then continue; end if;

    stmt := format('alter policy %I on public.%I', pol.policyname, pol.tablename);
    if q is not null then stmt := stmt || ' using (' || q || ')'; end if;
    if c is not null then stmt := stmt || ' with check (' || c || ')'; end if;
    execute stmt;
  end loop;
end $$;
