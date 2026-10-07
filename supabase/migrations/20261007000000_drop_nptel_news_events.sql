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
