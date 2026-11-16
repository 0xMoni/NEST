# How NEST works

```mermaid
flowchart LR
  subgraph Browser["Browser: plain HTML, CSS, JS (web/)"]
    L[login · forgot · reset<br/>change-password] --> G{js/api.js<br/>signed in? default password?<br/>right role?}
    G --> ST[student/<br/>dashboard, attendance, scorecard,<br/>timetable, mentor, profile]
    G --> FA[faculty/<br/>home, attendance, class report,<br/>marks, mentees]
    G --> AD[admin/<br/>overview, people,<br/>structure, timetable]
  end
  subgraph Supabase["Supabase (the database and the rules)"]
    AU[Auth: email + password]
    RLS{{Row-level security:<br/>each person sees only their own rows}}
    T[(profiles, sections, subjects,<br/>faculty_assignments, timetable_slots)]
    AT[(attendance_sessions,<br/>attendance_records)]
    MK[(assessments, marks)]
    MN[(mentorships, mentor_alerts,<br/>profile_edit_requests)]
  end
  L -- sign in --> AU
  ST & FA & AD -- every query, as the signed-in person --> RLS
  RLS --> T & AT & MK & MN
```

Every page is a thin HTML file in `web/<role>/` that loads `js/api.js` and its own
script from `js/pages/`. `api.js` holds the gate (signed in, past the forced
password change, the right role), draws the sidebar layout, and has the shared
helpers.

The browser key is public by design. What keeps one student out of another's
marks is row-level security in `supabase/migrations/` — the pages only decide
what to show, so a change to who-can-see-what is a migration, never a page edit.
