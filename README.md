# NEST

Nurturing Education & Student Tracking — attendance, marks and mentorship for a
college department that currently runs on spreadsheets.

Three roles in one app:

- **Student** — attendance, published marks, timetable, their mentor's alerts,
  and a profile whose sections stay locked until a mentor opens one
- **Faculty** — mark attendance, enter marks and publish them, a per-class
  attendance report, track mentees, send alerts, decide edit requests
- **HOD** — build the sections, subjects, teaching assignments and timetable
  everything else hangs off, and see everyone with an account

Anyone signed in can change their own password, and an account still on the
default password has to pick its own before it can go anywhere.

## Run it

```
cp web/config.example.js web/config.js   # Supabase URL + publishable key
npm run dev                              # serves web/ on http://localhost:3000
```

Plain HTML, CSS and JavaScript: no build step. `npm run dev` is just Python's
built-in static server, so any static server pointed at `web/` works too.

Supabase setup is in [`docs/supabase-setup.md`](docs/supabase-setup.md).
Test logins are in [`docs/dev-accounts.md`](docs/dev-accounts.md).

## How it is put together

The browser talks to Supabase directly with the public (publishable) key, as
the signed-in person. **Row-level security in the database is what decides
who sees and changes what** — the pages only decide what to show. So the
migrations in `supabase/` are the security of the whole app.

Three things need a secret and so wait for a small backend (Supabase Edge
Functions): signing in with a USN instead of an email, the HOD creating
accounts, and the AI roadmap and quiz. Until then accounts come from the
scripts in `scripts/`.

## Where things are

```
web/                 the app — open login.html
web/js/api.js        shared: Supabase client, sign-in gate, layout, helpers
web/js/auth.js       shared by the four sign-in pages
web/js/pages/        one script per page
web/student/ faculty/ admin/   the pages for each role (thin HTML shells)
web/css/             nest.css (design tokens and layout), web.css (forms, tables, page parts),
                     polish.css (motion, phones), login.css (the sign-in pages)
supabase/            migrations — apply in filename order
scripts/             seed accounts, a demo section, the roster and faculty imports
backend/             the certificate checker (Python, not wired in yet)
docs/                setup, test accounts, what is next
```

The original HTML mockups were removed once every page they drew was built. The
two not built yet — news & events, and online certifications — and the PDF export
code are still in git: `git show c0e66a1:mockups/news.html` (also
`certifications.html`, `nest.js`, `data.js`).
