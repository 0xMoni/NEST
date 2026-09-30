-- ============================================================
-- Identity: who a signed-in person is, and what they may see.
--
-- Supabase Auth stores the login in auth.users. This adds the
-- profile beside it, and turns row-level security on from the
-- start — retrofitting it later means auditing every query
-- already written.
-- ============================================================

create type public.user_role as enum ('student', 'faculty', 'admin');

create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text not null default '',
  role        public.user_role not null default 'student',
  usn         text unique,          -- the key the Excel register matches on
  dept        text,
  semester    smallint check (semester between 1 and 8),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

comment on column public.profiles.usn is
  'University seat number. Students sign in with email, but the attendance
   import matches on this, so both have to exist.';

alter table public.profiles enable row level security;

-- ------------------------------------------------------------
-- Role lookup.
--
-- security definer so it can read profiles without tripping the
-- very policies that call it. Without this a policy that reads
-- profiles to decide access to profiles recurses forever.
-- ------------------------------------------------------------
create or replace function public.current_role_is(target public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = target
  );
$$;

-- ------------------------------------------------------------
-- Policies
-- ------------------------------------------------------------

create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Faculty can see the students they teach or mentor. Narrowed in a later
-- migration once section_students and faculty_assignments exist; for now
-- faculty read all profiles, admin does everything.
create policy "faculty read profiles"
  on public.profiles for select
  using (public.current_role_is('faculty'));

create policy "admin reads every profile"
  on public.profiles for select
  using (public.current_role_is('admin'));

create policy "admin writes every profile"
  on public.profiles for all
  using (public.current_role_is('admin'))
  with check (public.current_role_is('admin'));

-- ------------------------------------------------------------
-- Every auth user gets a profile row, automatically.
--
-- Doing this in a trigger rather than in app code means a profile
-- can never be missing — including for users created straight from
-- the Supabase dashboard.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, usn)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'student'),
    nullif(new.raw_user_meta_data ->> 'usn', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
