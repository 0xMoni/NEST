-- ============================================================
-- Students sign in with their USN, not their email.
--
-- The college's own list uses two different email schemes — some
-- addresses are the USN, others are coded like 24a01.cse@ — and 35
-- students have no address recorded at all. Everyone knows their USN,
-- and it is already the key the attendance register matches on.
--
-- Supabase still authenticates on email underneath. This stores the
-- address beside the profile so a USN can be resolved to it in one
-- query, server side.
-- ============================================================

alter table public.profiles add column if not exists email text;

-- backfill from the accounts that already exist
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;

-- USNs are uppercase in the college's sheet but typed in any case.
-- Matching on the normalised form keeps lookups predictable.
create unique index if not exists profiles_usn_upper_idx
  on public.profiles (upper(usn))
  where usn is not null;

-- keep email filled for new accounts
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, usn)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'student'),
    nullif(new.raw_user_meta_data ->> 'usn', '')
  );
  return new;
end;
$$;

-- and in sync if an address is ever changed
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();
