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

## 3. Turn off public sign-ups

**Authentication → Sign In / Providers**: switch off **Allow new users to sign up**.
Accounts are made by the office with the scripts; nobody should be able to make
their own. (Making accounts with the secret key still works with this off.)

**Confirm email** (Authentication → Providers → Email) can stay on. The scripts
create every account already confirmed (`email_confirm`), so it never stops a
seeded or imported account from signing in; it would only apply to public
sign-ups, which are off.

## 4. Apply the migrations

In the dashboard's **SQL Editor**, run each file in `supabase/migrations/` in
filename order. They depend on each other, so the order matters.

**Run each file once, and only ever the new ones.** Most files redefine functions,
views and access rules, so pasting an old file again puts back what a later one
fixed. Since `20261119000000`, the database records which files it has
(`private.applied_migrations`), and every file stops with *"A later migration is
already applied"* instead of running out of order. To see what a database has:
`select * from private.applied_migrations order by version;`

| File | What it adds |
| --- | --- |
| `20260930000000_profiles_and_roles.sql` | `profiles`, the role enum, RLS, the signup trigger |
| `20261001000000_login_by_usn.sql` | `profiles.email`, so a USN can be resolved to an account |
| `20261002000000_academic_spine.sql` | Sections, subjects, timetable, attendance, marks, mentorships, and the two calculated views |
| `20261003…` – `20261008…` | Locked profile sections, mentor alerts, the forced password change, AI roadmaps |
| `20261116000000_lock_down_access.sql` | Who may see and change what — see below |
| `20261116010000_tidy_up.sql` | Students see teachers' names and their mentor's contact card only; one class per section per period; present/absent only; indexes; `ai_quiz_attempts` written down; `avatar_url` removed |
| `20261117000000_attendance_export.sql` | Attendance to Excel (`attendance_register()`, `section_attendance_summary()`); who last changed each attendance mark; no attendance for future dates; no mark above the maximum |
| `20261118000000_role_from_app_metadata.sql` | New teachers and HODs no longer come out as students: the profile follows `app_metadata` when the secret key sets it |
| `20261118010000_advisor_fixes.sql` | What Supabase's advisor flagged: the roster, teachers and mentor views read through functions in a `private` schema instead of running as their owner; every policy calls `auth.uid()` / `is_admin()` once per query, not once per row |
| `20261119000000_review_fixes.sql` | Records which migrations are applied, so old files refuse to run again; the role sync copies only what changed; only a real password change clears `must_change_password`; one section per student, one subject marked per section per period, periods 1–6; teachers can't delete a class they took; students read but can't write AI quiz attempts and roadmaps; helper functions closed to signed-out visitors |
| `20261120000000_academic_terms.sql` | Academic terms: every section belongs to a term, one term is current, and pages show the current term while earlier terms keep their records; one section per student per term; `promote_term()` moves every section one semester up into the next term; the HOD manages terms on the Structure page |
| `20261120010000_news_and_events.sql` | News & events (`posts`): teachers and the HOD post news or an event to every student, one semester or one section; students see what is meant for them |
| `20261120020000_certificates.sql` | Certificates: students upload to the private `certificates` Storage bucket, their mentor verifies or rejects (with a reason), the HOD sees all |
| `20261121000000_hod_removes_certificates.sql` | The HOD can remove any certificate and its file (from the student's report page); students and mentors still can't remove a verified one |
| `20261127000000_certificate_checks.sql` | Room for the automatic certificate check's findings (`auto_check`, `file_sha256`); only the `check-certificate` Edge Function can write them. Deploy the function too — see below |

**Run `20261118000000`, `20261118010000` and `20261119000000` before using the
current pages**, in that order: the pages read the views the first two create
(`v_class_roster`, `v_my_teachers`, `v_my_mentor`), and the third refuses to run
until both are in.

The three `20261120…` files follow, in order. After the first, check the term it
made on the HOD's **Structure** page: it is called *2026–27 odd semester* and runs
1 Aug 2026 to 31 Jan 2027, which is a guess; correct the dates there if they are off.

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

### The automatic certificate check (Edge Function)

`supabase/functions/check-certificate/` reads each uploaded certificate and tells
the mentor what it found: whether the student's name is on it, which provider
issued it (NPTEL, Coursera, Udemy, edX, Microsoft, AWS, Google, Oracle, Infosys
Springboard), the course and credential ID, whether the verification link is on
the provider's own site and actually opens, and whether the same file was
uploaded before. It only advises; the mentor still verifies or rejects. Without
it, uploads and the mentor's check work as before.

Run `20261127000000_certificate_checks.sql` first, then deploy it once (and again
after it changes):

```
npx supabase login
npx supabase functions deploy check-certificate --no-verify-jwt --project-ref <your-project-ref>
```

`--no-verify-jwt` is deliberate: the function checks who is calling itself, and
reads the certificate as that person, so nobody can check one they can't see.
It needs no secrets of its own; Supabase gives every function the project's URL
and keys.

Photos and scans have no text to read, so they come out as "couldn't tell" and
the mentor looks at them. The checks themselves: `node --test supabase/functions/check-certificate/`.

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
