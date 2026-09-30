# Dev accounts

Placeholder credentials for building against. **Not real.** Swap the domain for the
college's actual one when we get it — see *Changing the domain* below.

## Domain

```
nest.edu
```

Chosen because it's short to type, unmistakably a placeholder, and a normal enough
address that Supabase Auth won't reject it.

## The three accounts

| Role    | Email              | Password       | Used for                                    |
| ------- | ------------------ | -------------- | ------------------------------------------- |
| Student | student@nest.edu   | `NestDev2026!` | Attendance %, scorecard, timetable, profile |
| Faculty | faculty@nest.edu   | `NestDev2026!` | Marking attendance, entering marks, mentees |
| Admin   | admin@nest.edu     | `NestDev2026!` | Seeding sections, subjects, assignments     |

One per role rather than one per teammate, because the checks in §09 of the plan need
exactly this: three logins that each land in the right place and can't reach the others.
If we later want a personal login each, add `moni@nest.edu` and friends alongside these —
the role accounts should stay, since they're what the tests use.

## Rules while these are in use

- **Turn off email confirmation** in Supabase Auth while developing. `nest.edu` can't
  receive mail, so a confirmation step would lock everyone out of their own accounts.
- **Never seed these into production.** They're known credentials on a public repo.
- **Password reset can't be tested** with these. When we need to test that flow, we'll
  need real inboxes — worth remembering before the AI phase, not after.

## Changing the domain

Two places, once the app exists:

1. `NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN` in `.env.local` — and in the Vercel project settings
2. The matching database check, so the rule holds even if someone bypasses the browser

Right now, while it's still a mockup, it's one line: `COLLEGE_DOMAIN` at the top of the
form script in `mockups/login.html`. The placeholder text, the completion hint and the
error message all read from it.
