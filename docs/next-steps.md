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

Then `supabase/migrations/20261116010000_tidy_up.sql`:
- [x] Students see each subject's teacher name and their mentor's contact card, not teachers' private details.
- [x] A section can't get two classes in the same period.
- [x] Attendance is present or absent only.
- [x] Indexes on assessments by class, enrolment by student, alerts by mentor.
- [x] `ai_quiz_attempts` (made by hand in the dashboard) written into a migration, with its access rules. The AI features stay for the backend.
- [x] Removed `profiles.avatar_url` and the duplicate `current_role_is()` helper.

Then `supabase/migrations/20261117000000_attendance_export.sql`:
- [x] Attendance to Excel: teachers download (or save to Google Drive) a class's summary and date-by-date register, for the whole term or a date range; the HOD downloads a whole section, every subject side by side. Built by two database functions, so a term's register isn't cut off at the API's 1000-row limit.
- [x] Each attendance mark records who last changed it, and when.
- [x] No attendance for a date that hasn't happened yet (India's date, not UTC).
- [x] No mark above the assessment's maximum, and the maximum can't be lowered below marks already given.

Then `supabase/migrations/20261118000000_role_from_app_metadata.sql`:
- [x] Accounts made with the secret key (import scripts, seed scripts) get the role, USN, department and semester they were given. Before this, Supabase wrote `app_metadata` just after the signup trigger ran, so everyone came out a student.

Then `supabase/migrations/20261118010000_advisor_fixes.sql`:
- [x] Advisor "Security Definer View" (v_class_roster, v_my_teachers, v_my_mentor): now ordinary views over functions in a `private` schema the API doesn't expose. Same columns, same rows per person.
- [x] Advisor "Auth RLS Initialization Plan": all 37 policies that called `auth.uid()` or `is_admin()` per row now call them once per query.
- New policies: write `(select auth.uid())` and `(select public.is_admin())`, not the bare calls, or the advisor warning comes back.

Then `supabase/migrations/20261119000000_review_fixes.sql`:
- [x] The role sync copies only what changed; only a real password change clears `must_change_password`.
- [x] Old migration files refuse to run once a later one is applied (`private.applied_migrations`).
- [x] One subject marked per section per period; periods 1–6; teachers can't delete a class they took.
- [x] Students read but can't write AI quiz attempts and roadmaps; helper functions closed to signed-out visitors.

Then the three `20261120…` files:
- [x] **Academic terms.** Sections belong to a term; pages show the current one; earlier terms keep their records. The HOD adds terms, switches the current one and promotes every section a semester up on the Structure page. One section per student per term.
- [x] **News & events.** Teachers and the HOD post news or events (hackathon, workshop, talk) to every student, a semester or a section, from their own News & events page; students read theirs.
- [x] **Certificates.** Students upload to private Storage; mentors verify or reject (with a reason) on the Mentees page; the HOD can see all.
- [x] **Per-student report**, saved as PDF from the browser: details, attendance, published marks and verified certificates. From Mentees (mentors) and People (HOD).

## Before handing the project over
- [ ] Delete the demo accounts (`*@eastpoint.ac.in` test logins, `docs/dev-accounts.md`) and the demo section, or start a fresh Supabase project for the real data.
- [ ] Import the real roster and faculty with `scripts/import-roster.py` and `scripts/import-faculty.py`.
- [ ] Turn email confirmation back on, and set up real SMTP for password resets.
- [ ] Check the HOD list (query in `docs/supabase-setup.md`).

## Backend (needs a secret, so a small server — Supabase Edge Functions)
- [ ] Sign in and reset with a USN instead of an email
- [ ] HOD creates accounts and resets logins from the People page
- [ ] AI roadmap and quiz (Groq key)
- [x] Certifications: the automatic check runs on every upload (`check-certificate` Edge Function, ported from the Python checker in `backend/`) and advises the mentor. Not done: reading text from photos and scans (OCR), and filing copies in a teacher's Google Drive

## Later (see `docs/teacher-features.md`)
- [ ] HOD: enrol students in sections and assign mentors from the app (today: import scripts)
- [ ] Tasks and reminders (new tables)
- [ ] Email-to-news ingestion, notifications
