# What's next

The plain-HTML frontend lives in `web/` and runs on the existing Supabase
database (her Next.js app in `src/` is untouched). NPTEL is dropped.

## Done
- [x] `web/` scaffold: shared `api.js`, styles, login (email)
- [x] Teacher: mark attendance (corrections included)

## To set up
- [ ] Copy `web/config.example.js` to `web/config.js`, add Supabase URL and publishable key
- [ ] Test attendance against the real database with a faculty account
- [ ] Student login by USN (needs a small server step; the browser can't look up emails safely)

## Teacher features, in order (see `docs/teacher-features.md`)
1. [ ] IAT marks: enter, save as draft, publish per subject, edit after publishing
2. [ ] Mentees: list with attendance/marks, one mentee's page, send alerts, see acknowledgements
3. [ ] Mentees: approve or reject profile edit requests; edit own contact card
4. [ ] Teacher dashboard: today's classes, things waiting, mentees needing attention
5. [ ] Attendance extras: class view, below-75% list
6. [ ] Tasks and reminders (new tables)
7. [ ] Newsletters and events (new tables; the old ones were dropped)
8. [ ] Per-student PDF reports

## Then
- [ ] Student pages in plain HTML wired to real data (replace `mockups/data.js`)
- [ ] Admin pages (people, structure, timetable)
- [ ] Certifications: connect the Python checker in `backend/` to the app
- [ ] Later: email-to-news ingestion, notifications
