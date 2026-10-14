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
key already formatted for Next.js:

```
https://supabase.com/dashboard/project/_?showConnect=true
```

For the secret key, and to see everything in one place:

```
https://supabase.com/dashboard/project/_/settings/api-keys/
```

The `_` in those URLs resolves to whichever project you have open.

| Dashboard value | Goes into |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key (`sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Secret key (`sb_secret_…`) | `SUPABASE_SECRET_KEY` |

**On the naming.** Supabase renamed these: `anon` is now *publishable*, and
`service_role` is now *secret*. Older keys still work and both appear on the
same page, but the legacy pair is being retired at the end of 2026 — so take the
`sb_publishable_` / `sb_secret_` versions. Our variable names keep the old words
because that is what the Supabase client libraries still call the arguments.

There is no longer a **Settings → API** page; keys live under **Settings → API
Keys**.

## 3. Turn off email confirmation

**Authentication → Providers → Email**, and switch **Confirm email** off.

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

Or link the CLI and push them all:

```
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

The project ref is the subdomain of your project URL.

## 5. Seed something to work against

```
node scripts/seed-dev-users.mjs      # one account per role
node scripts/seed-demo-section.mjs   # CSE-5A: 6 subjects, 6 faculty, 24 students, a timetable
```

Both are safe to re-run. The demo section is invented people on a real structure —
the college's own student list is 514 actual people and never goes near this.


## 6. Check it worked

```
npm run dev
```

Sign in at `/login` as `1EP23CS001` with `123456` — a USN, not an email. You should
land on the student dashboard. Visiting `/login` while signed in should bounce you
away, which is the middleware doing its job.

## The check that actually matters

Once there's data, prove row-level security works before trusting it. In the SQL
Editor, query a second student's rows using the first student's session. It has
to come back **empty** — not an error, not a blank page. Empty. If it returns
rows, a policy is missing and nothing above it is protecting anything.
