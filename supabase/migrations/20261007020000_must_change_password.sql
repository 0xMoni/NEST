-- ============================================================
-- Make a student leave the default password behind.
--
-- Every account is created by the office on one shared password.
-- USNs are printed on noticeboards, so an account still sitting on
-- that password is open to anyone who can read a roll number. Being
-- able to change it was never the problem; nothing made anyone.
--
-- The flag starts true, including for the accounts that already
-- exist, because every one of them was created that way. It is
-- cleared by the change-password action, which runs on the caller's
-- own session — so a student can only ever clear their own.
--
-- Deliberately not a check against the literal '123456': the column
-- records whether this account has been through a change, which is
-- the thing being asked. Supabase hashes the password and will not
-- tell us what it is, and it should not.
-- ============================================================

alter table public.profiles
  add column if not exists must_change_password boolean not null default true;
