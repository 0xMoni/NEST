/** The six sections of a student profile, and which fields sit in each.
 *  Mirrors enforce_profile_locks() in the migration — if a field moves
 *  between sections here, it has to move there too, or the screen and the
 *  database will disagree about what is locked. */
export type SectionId = "student" | "parent" | "guardian" | "contact" | "academic" | "admission";

export type Field = { key: string; label: string; type?: "text" | "date" | "tel" | "email" };

export const SECTIONS: {
  id: SectionId;
  label: string;
  desc: string;
  office?: boolean;
  fields: Field[];
}[] = [
  {
    id: "student",
    label: "Student details",
    desc: "Personal information as on your records.",
    fields: [
      { key: "dob", label: "Date of birth", type: "date" },
      { key: "blood_group", label: "Blood group" },
      { key: "phone", label: "Phone", type: "tel" },
      { key: "personal_email", label: "Personal email", type: "email" },
    ],
  },
  {
    id: "parent",
    label: "Parent details",
    desc: "Parents or legal guardians on record.",
    fields: [
      { key: "father_name", label: "Father's name" },
      { key: "father_phone", label: "Father's phone", type: "tel" },
      { key: "mother_name", label: "Mother's name" },
      { key: "mother_phone", label: "Mother's phone", type: "tel" },
    ],
  },
  {
    id: "guardian",
    label: "Guardian details",
    desc: "Local guardian, if you live away from your parents.",
    fields: [
      { key: "guardian_name", label: "Name" },
      { key: "guardian_relation", label: "Relation" },
      { key: "guardian_phone", label: "Phone", type: "tel" },
    ],
  },
  {
    id: "contact",
    label: "Contact details",
    desc: "How the college reaches you.",
    fields: [
      { key: "address", label: "Address" },
      { key: "city", label: "City" },
      { key: "pincode", label: "PIN code" },
    ],
  },
  {
    id: "academic",
    label: "Academic details",
    desc: "Managed by the college office.",
    office: true,
    fields: [
      { key: "usn", label: "USN" },
      { key: "dept", label: "Department" },
      { key: "semester", label: "Semester" },
    ],
  },
  {
    id: "admission",
    label: "Admission details",
    desc: "Admission date and category.",
    fields: [
      { key: "admission_date", label: "Admission date", type: "date" },
      { key: "admission_quota", label: "Category" },
    ],
  },
];

export const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));
