-- Refuses to run once a later migration is applied: running an old
-- file again puts back what later ones fixed. See 20261119000000.
do $$
declare later boolean;
begin
  if to_regclass('private.applied_migrations') is not null then
    execute 'select exists (select 1 from private.applied_migrations where version > $1)'
       into later using '20261007000000';
    if later then
      raise exception 'A later migration is already applied; running 20261007000000 again would undo it.';
    end if;
  end if;
end $$;

-- ============================================================
-- Drop NPTEL, newsletters and events.
--
-- 20261006000000 originally created three features beside mentor
-- alerts: an NPTEL spine (courses, weeks, enrolments, weekly
-- progress and two derived views), newsletters, and events. None
-- of them were given a UI and all three are out of scope, so they
-- have been removed from that file — and this drops what a
-- database already migrated is still carrying.
--
-- The views go first: they depend on the tables. `cascade` is
-- deliberately not used — nothing outside these features
-- referenced any of it, and an unqualified drop says so by
-- failing rather than quietly taking something else with it.
-- ============================================================

drop view if exists public.v_nptel_course_score;
drop view if exists public.v_nptel_week_status;

drop table if exists public.nptel_progress;
drop table if exists public.nptel_enrolments;
drop table if exists public.nptel_weeks;
drop table if exists public.nptel_courses;

drop table if exists public.newsletters;

drop table if exists public.events;
drop type  if exists public.event_kind;
