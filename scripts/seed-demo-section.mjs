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
 * Safe to re-run: everything upserts on a natural key.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DOMAIN = "eastpoint.ac.in";
const PASSWORD = "123456";

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

async function user(email, meta) {
  const { data, error } = await db.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: meta,
  });
  if (!error) return data.user.id;
  if (!/already/i.test(error.message)) throw error;
  const { data: found } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  return found?.id ?? null;
}

// ---- subjects ----
const { data: subjects } = await db.from("subjects")
  .upsert(SUBJECTS.map((s) => ({ ...s, semester: 5 })), { onConflict: "code" })
  .select("id, code");
console.log(`subjects        ${subjects.length}`);

// ---- section ----
const { data: section } = await db.from("sections")
  .upsert({ dept: "CSE", semester: 5, name: "A" }, { onConflict: "dept,semester,name" })
  .select("id").single();
console.log(`section         CSE sem 5 A`);

// ---- faculty ----
const facultyIds = [];
for (let i = 0; i < FACULTY.length; i++) {
  const email = `faculty${i + 1}.cse@${DOMAIN}`;
  facultyIds.push(await user(email, { full_name: FACULTY[i], role: "faculty" }));
}
console.log(`faculty         ${facultyIds.filter(Boolean).length}`);

// ---- who teaches what ----
const { data: assignments } = await db.from("faculty_assignments")
  .upsert(subjects.map((s, i) => ({
    section_id: section.id, subject_id: s.id, faculty_id: facultyIds[i],
  })), { onConflict: "section_id,subject_id" })
  .select("id, subject_id");
console.log(`assignments     ${assignments.length}`);

// ---- timetable: six periods, Monday to Saturday ----
const slots = [];
for (let day = 1; day <= 6; day++) {
  for (let period = 1; period <= 6; period++) {
    // rotate so no subject always owns the same period
    slots.push({ assignment_id: assignments[(day + period) % assignments.length].id, day_of_week: day, period });
  }
}
await db.from("timetable_slots").upsert(slots, { onConflict: "assignment_id,day_of_week,period" });
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
await db.from("section_students")
  .upsert(studentIds.map((id) => ({ section_id: section.id, student_id: id })), { onConflict: "section_id,student_id" });
console.log(`students        ${studentIds.length}`);

// ---- mentors: four students each ----
await db.from("mentorships").upsert(
  studentIds.map((id, i) => ({ mentor_id: facultyIds[Math.floor(i / 6) % facultyIds.length], student_id: id })),
  { onConflict: "student_id" },
);
console.log(`mentorships     ${studentIds.length}`);

console.log(`\nAll accounts use the password ${PASSWORD}`);
console.log(`Students sign in with a USN, e.g. 1EP23CS001`);
console.log(`Faculty sign in with faculty1.cse@${DOMAIN}`);
