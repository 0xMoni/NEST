/**
 * Seeds one realistic section to develop against: 5th semester CSE-A, six
 * subjects, a faculty member per subject, a weekly timetable, and 24 students.
 *
 * People are invented; the structure is real — USN format, subject codes and
 * the six-period day all match the college's own. The real student list is
 * never used here, because it is 514 actual people.
 *
 *   node scripts/seed-demo-section.mjs
 *
 * Safe to re-run: everything upserts on a natural key. Any refusal from the
 * database stops it with the reason, rather than printing a count anyway.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL; // older .env.local files use the second name
if (!url || !process.env.SUPABASE_SECRET_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DOMAIN = "eastpoint.ac.in";
const PASSWORD = process.env.SEED_PASSWORD ?? "123456"; // invented dev accounts only; real ones come from the import scripts

const SUBJECTS = [
  { code: "BCS501", name: "Machine Learning", credits: 4 },
  { code: "BCS502", name: "Computer Networks", credits: 4 },
  { code: "BCS503", name: "Software Engg. & Project Mgmt", credits: 3 },
  { code: "BCS504", name: "Deep Learning", credits: 4 },
  { code: "BCSL505", name: "Data Visualization Lab", credits: 1 },
  { code: "BCS506", name: "Cloud Computing", credits: 3 },
];

const FACULTY = [
  "Dr. Meera Rao", "Prof. Arjun Nair", "Prof. Kavya S",
  "Dr. Rahul Menon", "Prof. Divya K", "Prof. Sanjay R",
];

const FIRST = ["Aarav","Diya","Rohan","Ananya","Karthik","Meghana","Nikhil","Sneha","Varun","Pooja",
               "Siddharth","Lakshmi","Aditya","Nandini","Vikram","Shreya","Harsha","Ishita","Tejas","Riya",
               "Manoj","Keerthi","Aniket","Divya"];
const LAST = ["Sharma","Reddy","Nair","Iyer","Gowda","Patel","Rao","Shetty","Hegde","Kulkarni"];

/** The result's data, or stop with the database's reason. */
function must({ data, error }, what) {
  if (error) {
    console.error(`${what}: ${error.message}`);
    process.exit(1);
  }
  return data;
}

async function user(email, meta) {
  const { data, error } = await db.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    // app_metadata is what the database trusts for role and USN: only the secret key can set it.
    user_metadata: meta, app_metadata: meta,
  });
  if (!error) return data.user.id;
  if (!/already/i.test(error.message)) throw error;
  const { data: found } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  return found?.id ?? null;
}

// ---- subjects ----
const subjects = must(await db.from("subjects")
  .upsert(SUBJECTS.map((s) => ({ ...s, semester: 5 })), { onConflict: "code" })
  .select("id, code"), "subjects");
// in SUBJECTS order, so each run gives a subject the same teacher and periods
subjects.sort((a, b) => SUBJECTS.findIndex((s) => s.code === a.code) - SUBJECTS.findIndex((s) => s.code === b.code));
console.log(`subjects        ${subjects.length}`);

// ---- section ----
// CSE-5A of the current term; a new section goes into the current term by itself
let section = must(await db.from("sections")
  .select("id, academic_terms!inner(is_current)")
  .eq("dept", "CSE").eq("semester", 5).eq("name", "A").eq("academic_terms.is_current", true)
  .maybeSingle(), "section");
if (!section) {
  section = must(await db.from("sections").insert({ dept: "CSE", semester: 5, name: "A" }).select("id").single(), "section");
}
console.log(`section         CSE sem 5 A`);

// ---- faculty ----
const facultyIds = [];
for (let i = 0; i < FACULTY.length; i++) {
  const email = `faculty${i + 1}.cse@${DOMAIN}`;
  facultyIds.push(await user(email, { full_name: FACULTY[i], role: "faculty" }));
}
console.log(`faculty         ${facultyIds.filter(Boolean).length}`);

// ---- who teaches what ----
const assignments = must(await db.from("faculty_assignments")
  .upsert(subjects.map((s, i) => ({
    section_id: section.id, subject_id: s.id, faculty_id: facultyIds[i],
  })), { onConflict: "section_id,subject_id" })
  .select("id, subject_id"), "assignments");
assignments.sort((a, b) => subjects.findIndex((s) => s.id === a.subject_id) - subjects.findIndex((s) => s.id === b.subject_id));
console.log(`assignments     ${assignments.length}`);

// ---- timetable: six periods, Monday to Saturday ----
const slots = [];
for (let day = 1; day <= 6; day++) {
  for (let period = 1; period <= 6; period++) {
    // rotate so no subject always owns the same period
    slots.push({ assignment_id: assignments[(day + period) % assignments.length].id, day_of_week: day, period });
  }
}
must(await db.from("timetable_slots").upsert(slots, { onConflict: "assignment_id,day_of_week,period" }), "timetable");
console.log(`timetable       ${slots.length} slots`);

// ---- students ----
const studentIds = [];
for (let i = 0; i < 24; i++) {
  const usn = `1EP23CS${String(i + 1).padStart(3, "0")}`;
  const name = `${FIRST[i]} ${LAST[i % LAST.length]}`;
  const id = await user(`${usn.toLowerCase()}@${DOMAIN}`, {
    full_name: name, role: "student", usn, dept: "CSE", semester: 5,
  });
  if (id) studentIds.push(id);
}
must(await db.from("section_students")
  .upsert(studentIds.map((id) => ({ section_id: section.id, student_id: id })), { onConflict: "section_id,student_id" }), "enrolment");
console.log(`students        ${studentIds.length}`);

// ---- mentors: four students each ----
must(await db.from("mentorships").upsert(
  studentIds.map((id, i) => ({ mentor_id: facultyIds[Math.floor(i / 6) % facultyIds.length], student_id: id })),
  { onConflict: "student_id" },
), "mentorships");
console.log(`mentorships     ${studentIds.length}`);

console.log(`\nAll accounts use the password ${PASSWORD}`);
console.log(`Students sign in with a USN, e.g. 1EP23CS001`);
console.log(`Faculty sign in with faculty1.cse@${DOMAIN}`);
