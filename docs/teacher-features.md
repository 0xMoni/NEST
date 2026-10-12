# Teacher features

Everything teachers need, mostly the other side of what students already see. Tick a box when it's built.

**Who's who**
- **Subject teacher**: teaches a subject to a class.
- **Mentor**: looks after a group of students (mentees).
- **Admin**: college office. Their items are marked *(admin)*.

**Status key**
- **Student side ready**: the student page that shows this already exists in `mockups/`.
- **Designed**: an early layout exists in the *NEST — Screens* canvas.

---

## 1. Teacher dashboard
- [ ] Today's classes, with the current one highlighted. *Designed (FacultyHome)*
- [ ] Things waiting on the teacher: marks to publish, profile edit requests, unacknowledged alerts.
- [ ] Mentees who need attention: below 75% attendance, low IAT marks, certificates that were rejected.
- [ ] Own weekly timetable.

## 2. Attendance
- [ ] Mark attendance for a period: whole class present by default, tap the absentees. *Designed (FacultyMark)*
- [ ] Phone version for marking in class. *Designed (FacultyMarkPhone)*
- [ ] Correct a past entry (wrongly marked absent). The fix shows up for the student right away.
- [ ] Class view: every student's percentage per subject.
- [ ] List of students below 75%, and those one miss away.
- [ ] Condonation form requests. *(open question: who approves?)*

Student side ready: Attendance page, dashboard Attendance card.

## 3. IAT marks (Scorecard)
- [ ] Enter IAT 1 and IAT 2 marks (out of 25) for a subject.
- [ ] Save as draft. Students can't see drafts.
- [ ] **Publish** per subject per IAT. Only then do students see the marks.
- [ ] Edit after publishing, with a note of what changed.
- [ ] Import marks from an Excel sheet.

Student side ready: Scorecard page (shows "Not published yet by …" until the teacher publishes).

## 4. Tasks and reminders
- [ ] Assign a task (assignment, lab record, quiz) to a class with a due date.
- [ ] Edit or cancel a task.
- [ ] See who has marked it done.

Student side ready: dashboard Reminders card.

## 5. Newsletter (teachers only)
- [ ] Post a newsletter: title, one-line summary, full text.
- [ ] Choose who sees it: a class, a year, the department, or everyone.
- [ ] Edit or delete own posts.
- [ ] See how many students have read it.

Student side ready: News & events → Newsletter.

## 6. Events: hackathons, workshops, talks
- [ ] Post an event: type, date, title, description, venue, time, team size, deadline, **link** to the event page.
- [ ] Event disappears for students after its date.
- [ ] Edit or delete own events.

Student side ready: News & events → Hackathons / Workshops / Talks, dashboard Upcoming.

## 7. Mentoring
- [ ] Mentee list with attendance, marks and certificates at a glance. *Designed (FacultyMentees)*
- [ ] One mentee's full picture: attendance, IAT marks, certificates, profile, past alerts.
- [ ] **Send an alert** to one mentee or all of them, with an optional due date and an "urgent" flag.
- [ ] See who has **acknowledged** each alert, and who hasn't.
- [ ] Approve or reject a mentee's request to edit locked profile sections (and set until when).
- [ ] Download a mentee's SGPA and CGPA report as PDF (SGPA for each finished semester).
- [ ] Download a mentee's admission documents (10th, 12th, study and migration certificates, admission letter, receipt).
- [ ] Edit own contact card: email, phone, cabin, office hours, Active/Away status.

Student side ready: Mentor page, dashboard Mentor alerts card, the mentor pop-in, profile "Request edit access".

## 8. Online certifications
- [ ] Create the Google Drive folder for the class and share it with the NEST service account (one-off setup, see `backend/README.md`).
- [ ] See every student's certificates in that Drive folder, sorted into one subfolder per provider.
- [ ] Look through the **Needs review** folder: certificates the checker couldn't confirm by itself.
- [ ] Mentor view: each mentee's certificates and their status (verified, needs review, rejected).
- [ ] Add a provider the checker doesn't know yet (`backend/certifications/providers.py`).

Student side ready: Online certifications page (upload, status), dashboard card.
Backend ready: `backend/certifications` (read, check, classify, file in Drive). Not yet connected to the web app.

## 9. PDF reports (for teachers, per student)
- [ ] Download one student's attendance report as PDF (light mode).
- [ ] Download one student's scorecard as PDF.
- [ ] Download a whole class at once *(maybe later)*.

Ready to reuse: the PDF code in `mockups/nest.js` (`NEST.exportPDF`), already tested on the attendance and scorecard reports.

## 10. Admin
- [ ] *(admin)* Build and publish the class timetable. *Designed (AdminTimetable)*
- [ ] *(admin)* Assign mentors to students.
- [ ] *(admin)* Add teachers and students, and reset logins.

## Later
- [ ] College email → NEST: pick up club, placement and department emails and post them as news or events automatically (hackathon / workshop / talk sorted by rules, then AI).
- [ ] Notifications (email or in-app) when a teacher publishes marks or sends an alert.
