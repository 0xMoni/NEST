# NEST

**Nurturing Education & Student Tracking** — attendance, marks and mentorship for a
college department that currently runs on spreadsheets.

Three roles in one app:

| Role | What they do |
| --- | --- |
| **Student** | Their attendance against the 75% rule, published marks, timetable |
| **Faculty** | Mark attendance from their timetable, enter and publish marks, track mentees |
| **HOD / DOE** | Create accounts, set up sections, subjects, assignments and the timetable |

## Running it

```
npm install
cp .env.example .env.local      # then fill in the Supabase values
npm run dev
```

Supabase setup, including which migrations to apply, is in
[`docs/supabase-setup.md`](docs/supabase-setup.md). Test logins are in
[`docs/dev-accounts.md`](docs/dev-accounts.md).

## How it is put together

- **Next.js App Router**, TypeScript, CSS modules. Pages render on the server and
  query Supabase through the caller's own session.
- **Row-level security is the access control.** Pages do not filter by user id —
  Postgres decides what a query returns. A page that forgot to filter still cannot
  leak another student's marks.
- **Faculty scope flows from one table**, `faculty_assignments`, which pairs a
  teacher with a subject and a section. Every faculty policy traces back to it.
- **Percentages are views, not columns.** Store a percentage and a corrected
  absence leaves a stale number on someone's screen.
- **Students sign in with a USN**, staff with an email. The lookup happens in a
  route handler so nobody can walk the USN range and collect addresses.

## Layout

```
src/app/(student|faculty|admin)   one route group per role
src/app/profile                   shared, currently linked for faculty
src/lib/supabase                  server, middleware and admin clients
src/lib/session.ts                requireUser / requireRole
supabase/migrations               schema and policies, applied in order
scripts                           seed the dev accounts and a demo section
mockups                           static design references, not shipped
```
