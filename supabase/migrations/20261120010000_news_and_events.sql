-- ============================================================
-- News & events: posted by teachers and the HOD, read by students.
--
-- One table for both. A post is news (a newsletter or notice) or
-- an event (hackathon, workshop, talk) with a date. It goes to
-- everyone, to one semester, or to one section of the current
-- term. Students read what is meant for them; staff read all of it.
-- A teacher edits and removes their own posts; the HOD, anyone's.
--
-- The poster's name is stored on the post, because students can't
-- read teachers' profiles.
--
-- Run after 20261120000000_academic_terms.sql. Safe to run more
-- than once.
-- ============================================================

do $$
declare later boolean;
begin
  if to_regclass('private.applied_migrations') is null then
    raise exception 'Run 20261119000000_review_fixes.sql first.';
  end if;
  execute 'select exists (select 1 from private.applied_migrations where version > $1)'
     into later using '20261120010000';
  if later then
    raise exception 'A later migration is already applied; running 20261120010000 again would undo it.';
  end if;
end $$;

create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('news', 'hackathon', 'workshop', 'talk')),
  title        text not null check (length(trim(title)) between 1 and 200),
  summary      text check (length(summary) <= 300),
  body         text check (length(body) <= 10000),
  -- events only
  event_on     date,
  event_time   text check (length(event_time) <= 80),
  location     text check (length(location) <= 120),
  team         text check (length(team) <= 80),
  closes       text check (length(closes) <= 120),
  link         text check (link is null or link ~* '^https?://'),
  -- who it is for: both empty means every student
  semester     smallint check (semester between 1 and 8),
  section_id   uuid references public.sections (id) on delete cascade,
  posted_by    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  posted_by_name text,
  created_at   timestamptz not null default now(),
  check (kind = 'news' or event_on is not null)
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_section_id_idx on public.posts (section_id);

-- Name the poster, and keep posted_by honest on edits.
create or replace function public.stamp_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.posted_by := old.posted_by;
    new.posted_by_name := old.posted_by_name;
    new.created_at := old.created_at;
  else
    select full_name into new.posted_by_name from public.profiles where id = new.posted_by;
  end if;
  if new.kind = 'news' then
    new.event_on := null; new.event_time := null; new.location := null;
    new.team := null; new.closes := null;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_stamp on public.posts;
create trigger posts_stamp
  before insert or update on public.posts
  for each row execute function public.stamp_post();

-- Is this post meant for the signed-in user? Staff: every post.
create or replace function public.post_is_for_me(p_semester smallint, p_section uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.profiles where id = auth.uid() and role in ('faculty', 'admin')) then true
    else (p_section is null or public.studies_in_section(p_section))
     and (p_semester is null or exists (
           select 1
             from public.section_students ss
             join public.sections s on s.id = ss.section_id
             join public.academic_terms t on t.id = s.term_id
            where ss.student_id = auth.uid() and t.is_current and s.semester = p_semester))
  end;
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('faculty', 'admin'));
$$;

revoke all on function public.post_is_for_me(smallint, uuid), public.is_staff() from public, anon;
grant execute on function public.post_is_for_me(smallint, uuid), public.is_staff() to authenticated;

alter table public.posts enable row level security;

drop policy if exists "read posts meant for you" on public.posts;
create policy "read posts meant for you" on public.posts for select
  using (public.post_is_for_me(semester, section_id));

drop policy if exists "staff post in their own name" on public.posts;
create policy "staff post in their own name" on public.posts for insert
  with check ((select public.is_staff()) and posted_by = (select auth.uid()));

drop policy if exists "edit own posts, or any as HOD" on public.posts;
create policy "edit own posts, or any as HOD" on public.posts for update
  using (posted_by = (select auth.uid()) or (select public.is_admin()))
  with check ((select public.is_staff()));

drop policy if exists "remove own posts, or any as HOD" on public.posts;
create policy "remove own posts, or any as HOD" on public.posts for delete
  using (posted_by = (select auth.uid()) or (select public.is_admin()));

revoke all on public.posts from anon;
grant select, insert, update, delete on public.posts to authenticated;

insert into private.applied_migrations (version) values ('20261120010000')
on conflict (version) do nothing;
