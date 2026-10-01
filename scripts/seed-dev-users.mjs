/**
 * Creates the three placeholder accounts from docs/dev-accounts.md.
 *
 * Uses the admin API, which needs the service role key — so this runs on your
 * machine only, never in the app. Safe to re-run: existing users are skipped.
 *
 *   node scripts/seed-dev-users.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Minimal .env.local reader, so this needs no extra dependency.
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;
// Dev accounts live on a real college domain so they pass the same check a
// student does. The dev. prefix keeps them obviously distinct from anyone real.
const domain = process.argv[2] ?? "eastpoint.ac.in";

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const users = [
  { email: `dev.student@${domain}`, full_name: "Aarav Sharma", role: "student", usn: "23AD014" },
  { email: `dev.faculty@${domain}`, full_name: "Dr. Meera Rao", role: "faculty", usn: null },
  { email: `dev.admin@${domain}`, full_name: "NEST Admin", role: "admin", usn: null },
];

const PASSWORD = "NestDev2026!";

for (const u of users) {
  const { error } = await admin.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true, // these addresses can't receive mail, so confirm them here
    user_metadata: { full_name: u.full_name, role: u.role, usn: u.usn },
  });

  if (error) {
    const exists = /already/i.test(error.message);
    console.log(`${exists ? "·" : "✗"} ${u.email.padEnd(24)} ${exists ? "already exists" : error.message}`);
  } else {
    console.log(`✓ ${u.email.padEnd(24)} created as ${u.role}`);
  }
}

console.log(`\nPassword for all three: ${PASSWORD}`);
