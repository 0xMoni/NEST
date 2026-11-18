# Dev accounts

Invented people on a real structure. The college's own list is 514 actual students
and is gitignored — it never goes near this.

**Every account below uses the password `123456`.**

## Students

```
1ep23cs001@eastpoint.ac.in   1EP23CS001   Aarav Sharma
1ep23cs002@eastpoint.ac.in   1EP23CS002   Diya Reddy
…
1ep23cs024@eastpoint.ac.in   1EP23CS024
```

All 24 are in **CSE-5A**, the section that has a timetable, subjects and faculty —
so whichever you pick sees real data. `1EP23CS001` is the easiest to find in a
roll list.

For now everyone signs in with their **email**. Signing in with just the USN needs a
small server step (looking up an email from a USN cannot be done safely in the
browser), and comes with the backend.

## Faculty — sign in with the email

```
faculty1.cse@eastpoint.ac.in   Dr. Meera Rao      Machine Learning
faculty2.cse@eastpoint.ac.in   Prof. Arjun Nair   Computer Networks
…
faculty6.cse@eastpoint.ac.in
```

## HOD

```
hod.test@eastpoint.ac.in    Test HOD        password 123456
dev.admin@eastpoint.ac.in   NEST Admin      password changed from 123456, not recorded
```

## Test logins that skip the first-sign-in password change

Made on 18 Nov 2026 for testing, after the passwords of `faculty1.cse@…`,
`dev.faculty@…` and `dev.admin@…` were changed and not written down. If you change
one of these, write the new password here.

```
hod.test@eastpoint.ac.in       HOD       123456
faculty.test@eastpoint.ac.in   Faculty   123456   teaches BCS501 Machine Learning in CSE-5B
1ep23cs001@eastpoint.ac.in     Student   123456   CSE-5A, mentor Dr. Meera Rao
```

## Recreating them

```
node scripts/seed-dev-users.mjs      # one per role
node scripts/seed-demo-section.mjs   # CSE-5A and everyone in it
```

Both upsert, so re-running is safe. `SEED_PASSWORD` overrides the default.

## `123456` is a default, not a password

Accounts are created by an administrator, so every new student starts on the same
default. That is normal, and safe only while the second half is true: the account
must demand a new password on first sign-in.

Every new account carries `must_change_password` on `profiles`. Until it is
cleared, every page sends that person to `change-password.html`, and picking a
password there (or through a reset link) clears it. Anyone can change theirs again
later on the **Account** page.

`1EP23CS001` has the flag cleared, so it goes straight in — handy for testing the
student pages. The faculty accounts still carry it, so signing in as one shows the
change-password screen first.

## Rules while these exist

- **Turn off email confirmation** in Supabase Auth while developing. These addresses
  cannot receive mail, so confirmation would lock the accounts out of themselves.
- **Never seed these into production.** They are known credentials on a public repo.
- **Password reset cannot be tested** with them. That needs real inboxes.
