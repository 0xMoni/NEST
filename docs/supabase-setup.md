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

**Project Settings → API**, and copy into `.env.local`:

| Dashboard field | Goes into |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` / publishable key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` |

The `anon` key is meant to be public — it ends up in the page source either way,
and row-level security is what actually protects the data. The `service_role`
key bypasses every policy we write. It has no `NEXT_PUBLIC_` prefix for exactly
that reason, and it must never be imported into anything that runs in a browser.

## 3. Turn off email confirmation

**Authentication → Providers → Email**, and switch **Confirm email** off.

Our placeholder accounts are on `nest.edu`, which cannot receive mail. Leave
confirmation on and every seeded account is locked out of itself. Turn it back
on before this is ever used with real addresses.

## 4. Apply the schema

Either paste `supabase/migrations/20260930000000_profiles_and_roles.sql` into the
dashboard's **SQL Editor** and run it, or link the CLI and push:

```
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

The project ref is the subdomain of your project URL.

## 5. Create the dev accounts

```
node scripts/seed-dev-users.mjs
```

Creates the three logins in `dev-accounts.md`. Safe to re-run.

## 6. Check it worked

```
npm run dev
```

Sign in at `/login` as `student@nest.edu` with `NestDev2026!`. You should be
redirected away from the login page. Visiting `/login` while signed in should
bounce you too — that's the middleware doing its job.

## The check that actually matters

Once there's data, prove row-level security works before trusting it. In the SQL
Editor, query a second student's rows using the first student's session. It has
to come back **empty** — not an error, not a blank page. Empty. If it returns
rows, a policy is missing and nothing above it is protecting anything.
