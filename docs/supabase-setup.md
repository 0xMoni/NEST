# Setting up Supabase

Roughly ten minutes. Steps 1–3 have to be done by hand in the browser; the rest
is scripted.

## 1. Create the project

1. Sign in at [supabase.com](https://supabase.com) and choose **New project**
2. **Name:** `nest`
3. **Database password:** generate one and save it somewhere. You will not be
   shown it again, and you need it for direct database access.
4. **Region:** pick the closest one. From India that's **South Asia (Mumbai)** —
   region only affects latency, but a badly chosen one is noticeable.
5. Create, then wait about two minutes while it provisions.

## 2. Copy the keys

Fastest route — the **Connect** dialog, which hands you the URL and publishable
key ready to copy:

```
https://supabase.com/dashboard/project/_?showConnect=true
```

For the secret key, and to see everything in one place:

```
https://supabase.com/dashboard/project/_/settings/api-keys/
```

The `_` in those URLs resolves to whichever project you have open.

| Dashboard value | Goes into | Used by |
| --- | --- | --- |
| Project URL | `SUPABASE_URL` in `web/config.js` **and** `.env.local` | the pages, the scripts |
| Publishable key (`sb_publishable_…`) | `SUPABASE_PUBLISHABLE_KEY` in `web/config.js` | the pages |
| Secret key (`sb_secret_…`) | `SUPABASE_SECRET_KEY` in `.env.local` | the scripts only — never in `web/` |

`.env.local` starts as a copy of `.env.example`; `web/config.js` as a copy of
`web/config.example.js`. Both are gitignored.

**On the naming.** Supabase renamed these: `anon` is now *publishable*, and
`service_role` is now *secret*. Older keys still work and both appear on the
same page, but the legacy pair is being retired at the end of 2026 — so take the
`sb_publishable_` / `sb_secret_` versions.

There is no longer a **Settings → API** page; keys live under **Settings → API
Keys**.

## 3. Turn off public sign-ups, and email confirmation

**Authentication → Sign In / Providers**: switch off **Allow new users to sign up**.
Accounts are made by the office with the scripts; nobody should be able to make
their own. (Making accounts with the secret key still works with this off.)

Then **Authentication → Providers → Email**, and switch **Confirm email** off.

Our dev accounts use addresses that cannot receive mail. Leave
confirmation on and every seeded account is locked out of itself. Turn it back
on before this is ever used with real addresses.

## 4. Apply the migrations

In the dashboard's **SQL Editor**, run each file in `supabase/migrations/` in
filename order. They depend on each other, so the order matters:

| File | What it adds |
| --- | --- |
| `20260930000000_profiles_and_roles.sql` | `profiles`, the role enum, RLS, the signup trigger |
| `20261001000000_login_by_usn.sql` | `profiles.email`, so a USN can be resolved to an account |
| `20261002000000_academic_spine.sql` | Sections, subjects, timetable, attendance, marks, mentorships, and the two calculated views |
| `20261003…` – `20261008…` | Locked profile sections, mentor alerts, the forced password change, AI roadmaps |
| `20261116000000_lock_down_access.sql` | Who may see and change what — see below. **Run this before using the current pages**: the teacher pages read its `v_class_roster` view |

### What `lock_down_access` changes

- A sign-up can no longer make itself HOD or claim a USN. Role, USN, department and
  semester come only from `app_metadata`, which only the secret key (the scripts) can set.
- Subject teachers see a class roster (name, USN) instead of every student's profile;
  mentors still see their mentees' full profiles, and now their attendance and
  published marks in every subject.
- Staff can edit their own phone; students' sections stay locked until a mentor opens one.
- Department and semester are filled in from each student's section.
- A class that already has attendance or marks can't be deleted.

After running it, check nobody made themselves HOD while the hole was open. In the
SQL Editor:

```sql
select p.email, p.full_name, p.role, u.created_at
  from public.profiles p join auth.users u on u.id = p.id
 where p.role = 'admin'
 order by u.created_at;
```

Every row should be an account the office made. For one that isn't:
`update public.profiles set role = 'student' where email = '…';`, then delete the
user under **Authentication → Users**.

Or link the CLI and push them all:

```
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

The project ref is the subdomain of your project URL.

## 5. Seed something to work against

```
npm install                          # once: the Supabase library the scripts use
node scripts/seed-dev-users.mjs      # one account per role
node scripts/seed-demo-section.mjs   # CSE-5A: 6 subjects, 6 faculty, 24 students, a timetable
```

Both are safe to re-run. The demo section is invented people on a real structure —
the college's own student list is 514 actual people and never goes near this.


## 6. Point the web pages at it

```
cp web/config.example.js web/config.js
```

Put the **Project URL** and the **publishable key** in `web/config.js`. Never the
secret key: everything in `web/` runs in the browser.

## 7. Allow the reset-password link

**Authentication → URL Configuration**:

- **Site URL:** where the app is served, e.g. `http://localhost:3000` while developing
- **Redirect URLs:** add `http://localhost:3000/reset-password.html`, and the same
  path on the real address once it is deployed

Supabase refuses to send people anywhere not on that list.

**Optional, recommended:** the stock reset email spends its one-time token the moment
anything opens the link — and mail scanners and click trackers open links before the
person does. Under **Authentication → Emails → Reset password**, change the link to:

```
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
```

`reset-password.html` then waits for the person to press Continue before spending it.
Both forms of the link work; this one just survives scanners.

## 8. Check it worked

```
npm run dev
```

Open `http://localhost:3000`, and sign in as `1ep23cs001@eastpoint.ac.in` with
`123456`. You should land on the student dashboard. Opening `login.html` while
signed in sends you to your own home instead.

## The check that actually matters

Once there's data, prove row-level security works before trusting it. In the SQL
Editor, query a second student's rows using the first student's session. It has
to come back **empty** — not an error, not a blank page. Empty. If it returns
rows, a policy is missing and nothing above it is protecting anything.
