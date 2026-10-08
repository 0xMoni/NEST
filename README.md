# NEST

Nurturing Education & Student Tracking — attendance, marks and mentorship for a
college department that currently runs on spreadsheets.

Three roles in one app:

- **Student** — attendance, published marks, timetable, their mentor's alerts,
  and a profile whose sections stay locked until a mentor opens one
- **Faculty** — mark attendance, enter marks, track mentees, send a mentee an
  alert, decide their edit requests
- **HOD** — create accounts, and build the sections, subjects, faculty
  assignments and timetable everything else hangs off

Anyone signed in can change their own password.

## Run it

```
npm install
cp .env.example .env.local      # fill in the Supabase values
npm run dev
```

Supabase setup is in [`docs/supabase-setup.md`](docs/supabase-setup.md).
Test logins are in [`docs/dev-accounts.md`](docs/dev-accounts.md) — sign in as
`1EP23CS001` with `123456`.

## Stack

Next.js (App Router), TypeScript, CSS Modules, Supabase.

Who may read or write what is decided by row-level security in Postgres, not by
the pages. A page asks for every row it wants and the database returns the ones
that caller is allowed — so a screen cannot leak something by forgetting a
filter. Where RLS cannot express a rule, a trigger does: a student may
acknowledge an alert but not reword it, and locked profile fields stay locked
even if the request skips the form entirely.

## Where things are

```
src/app         pages, one folder per role
src/components  the shell, shared UI, the password form
src/lib         Supabase clients, session helpers, profile sections
supabase        migrations — apply in filename order
scripts         seed accounts and a demo section
mockups         design references, not shipped
```
