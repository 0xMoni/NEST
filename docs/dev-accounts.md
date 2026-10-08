# Dev accounts

Invented people on a real structure. The college's own list is 514 actual students
and is gitignored — it never goes near this.

**Every account below uses the password `123456`.**

## Students — sign in with the USN

```
1EP23CS001   Aarav Sharma
1EP23CS002   Diya Reddy
…
1EP23CS024
```

All 24 are in **CSE-5A**, the section that has a timetable, subjects and faculty —
so whichever you pick sees real data. `1EP23CS001` is the easiest to find in a
roll list.

Type the USN alone. No `@`, no email.

## Faculty — sign in with the email

```
faculty1.cse@eastpoint.ac.in   Dr. Meera Rao      Machine Learning
faculty2.cse@eastpoint.ac.in   Prof. Arjun Nair   Computer Networks
…
faculty6.cse@eastpoint.ac.in
```

## HOD

```
dev.admin@eastpoint.ac.in
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

Faculty can change theirs on **Profile**. Nothing yet *forces* anyone to, so for now
"default" quietly becomes "permanent" for anyone who never thinks about it.

**Still to build:** a `must_change_password` flag on `profiles`, set when an account
is created and cleared once the student picks their own. The middleware already runs
on every request, so it only has to send anyone carrying that flag to a
change-password screen before letting them anywhere else.

## Rules while these exist

- **Turn off email confirmation** in Supabase Auth while developing. These addresses
  cannot receive mail, so confirmation would lock the accounts out of themselves.
- **Never seed these into production.** They are known credentials on a public repo.
- **Password reset cannot be tested** with them. That needs real inboxes.
