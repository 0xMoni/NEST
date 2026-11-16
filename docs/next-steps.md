# What's next

The app is the plain-HTML frontend in `web/`, talking straight to Supabase. The
Next.js version that used to live in `src/` has been removed. NPTEL is dropped.

## Done
- [x] `web/` scaffold: shared `api.js`, styles, login
- [x] One layout for every page (the mockups' sidebar), light/dark theme remembered across pages
- [x] Sign-in sends each role to its own home; wrong-role pages bounce to your own
- [x] Forced password change on first sign-in (`must_change_password`)
- [x] Forgot / reset password (email link, survives mail scanners), change password on Account
- [x] Teacher: home (today's classes, waiting items, mentees below 75%, the week)
- [x] Teacher: mark attendance, corrections, extra classes on any past date
- [x] Teacher: class report (per student, below 75%, one miss away)
- [x] Teacher: IAT marks — enter, draft, publish, unpublish
- [x] Teacher: mentees — list, approve/decline edit requests, send alerts, see acknowledgements, contact card
- [x] Student: dashboard, attendance (per class), scorecard, timetable, mentor + alerts, profile with locked sections
- [x] HOD: overview, people list, structure (sections, subjects, who teaches what), timetable editor

## Database (next)
These are in the database, not the pages, and matter more now that the browser
talks to it directly — row-level security is the only lock.
- [ ] **Critical:** the signup trigger takes `role` from what the person signing up sends, so anyone can make themselves HOD. Fix the trigger and turn off public sign-ups.
- [ ] Narrow "faculty read profiles": every teacher can currently read every student's private details.
- [ ] Let mentors see their mentees' attendance and marks in every subject (today: only subjects they teach).
- [ ] Faculty can't change their own phone (the student profile lock catches it).
- [ ] New accounts never get `dept` / `semester` (the trigger ignores them).
- [ ] `ai_quiz_attempts` table is missing.
- [ ] Removing a teaching assignment cascades into its attendance and marks (the page refuses; the database should too).

## Backend (needs a secret, so a small server — Supabase Edge Functions)
- [ ] Sign in and reset with a USN instead of an email
- [ ] HOD creates accounts and resets logins from the People page
- [ ] AI roadmap and quiz (Groq key)
- [ ] Certifications: connect the Python checker in `backend/`

## Later (see `docs/teacher-features.md`)
- [ ] HOD: enrol students in sections and assign mentors from the app (today: import scripts)
- [ ] Tasks and reminders (new tables)
- [ ] Newsletters and events (new tables; the old ones were dropped)
- [ ] Per-student PDF reports
- [ ] Email-to-news ingestion, notifications
