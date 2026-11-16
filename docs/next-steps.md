# What's next

The app is the plain-HTML frontend in `web/`, talking straight to Supabase. The
Next.js version that used to live in `src/` has been removed. NPTEL is dropped.

## Done
- [x] `web/` scaffold: shared `api.js`, styles, login
- [x] One layout for every page (sidebar, stats, cards), light/dark theme remembered across pages
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

## Database
Fixed in `supabase/migrations/20261116000000_lock_down_access.sql`:
- [x] **Critical:** sign-ups could make themselves HOD. Role, USN, department and semester now come only from `app_metadata`, which only the secret key can set.
- [x] Teachers no longer read every student's private details: mentors read their mentees' profiles; subject teachers get a name-and-USN roster (`v_class_roster`).
- [x] Mentors see their mentees' attendance and published marks in every subject.
- [x] Faculty can change their own phone number.
- [x] Department and semester filled in from each student's section, now and on every enrolment.
- [x] A teaching assignment with attendance or marks can't be deleted.
- [x] Attendance, marks, alerts and edit-request decisions can't be saved in someone else's name or for students outside the class.
- [x] AI roadmaps: readable by the student, their mentor and the HOD only.
- [ ] **Turn off public sign-ups** in the dashboard (Authentication → Sign In / Providers → "Allow new users to sign up").
- [ ] `ai_quiz_attempts` table: add it with the AI backend, which is what uses it.

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
