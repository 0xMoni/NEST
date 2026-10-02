# NEST

Nurturing Education & Student Tracking — attendance, marks and mentorship for a
college department that currently runs on spreadsheets.

Three roles in one app:

- **Student** — their attendance, published marks, timetable
- **Faculty** — mark attendance, enter marks, track mentees
- **HOD / DOE** — create accounts, set up sections, subjects and the timetable

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

Next.js (App Router), TypeScript, Supabase.

## Where things are

```
src/app         pages, one folder per role
src/lib         Supabase clients and session helpers
supabase        migrations — apply in filename order
scripts         seed accounts and a demo section
mockups         design references, not shipped
```
