# Dev accounts

Placeholder credentials for building against. **Not real students.**

## Domains

The college splits students across two domains:

| Domain | Who |
| --- | --- |
| `eastpoint.ac.in` | 5th and 7th semester |
| `epcet.ac.in` | 3rd semester |

Both are accepted at login, via `NEXT_PUBLIC_COLLEGE_EMAIL_DOMAINS`.

## The three accounts

| Role | Email | Password |
| --- | --- | --- |
| Student | `dev.student@eastpoint.ac.in` | `NestDev2026!` |
| Faculty | `dev.faculty@eastpoint.ac.in` | `NestDev2026!` |
| Admin | `dev.admin@eastpoint.ac.in` | `NestDev2026!` |

They sit on a real college domain so they pass exactly the same check a student
does — testing against a fake domain would have proved nothing about the real
path. The `dev.` prefix keeps them unmistakably distinct from anyone real.

One account per role rather than one per teammate, because the checks in the plan
need exactly this: three logins that each land in the right place and cannot reach
the others.

Create or re-create them with:

```
node scripts/seed-dev-users.mjs
```

Safe to re-run. Pass a different domain as an argument to override.

## Rules while these exist

- **Turn off email confirmation** in Supabase Auth while developing. These
  addresses cannot receive mail, so a confirmation step would lock them out of
  their own accounts.
- **Never seed these into production.** They are known credentials on a public repo.
- **Password reset cannot be tested** with them. That flow needs real inboxes.
- **Do not confuse them with the real list.** The college's spreadsheet has 514
  actual students; it is gitignored and must stay out of the repo.
