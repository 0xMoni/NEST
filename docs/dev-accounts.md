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
| Student | `dev.student@eastpoint.ac.in` | `123456` |
| Faculty | `dev.faculty@eastpoint.ac.in` | `123456` |
| Admin | `dev.admin@eastpoint.ac.in` | `123456` |

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

## `123456` is a default, not a password

Accounts are created by an administrator, so every new student starts on the
same default. That is normal, and safe only while the second half is true: the
account must demand a new password on first sign-in.

Without that, "default" quietly becomes "permanent" for most of the 514 students,
and every one of their accounts shares a password that appears at the top of every
breach list. The attendance and marks behind those logins are exactly what the
permission rules were written to protect.

**Still to build:** a `must_change_password` flag on `profiles`, set true when an
account is created and cleared once the student picks their own. The middleware
then sends anyone carrying that flag to a change-password screen before it lets
them reach anything else.

## Rules while these exist

- **Turn off email confirmation** in Supabase Auth while developing. These
  addresses cannot receive mail, so a confirmation step would lock them out of
  their own accounts.
- **Never seed these into production.** They are known credentials on a public repo.
- **Password reset cannot be tested** with them. That flow needs real inboxes.
- **Do not confuse them with the real list.** The college's spreadsheet has 514
  actual students; it is gitignored and must stay out of the repo.
