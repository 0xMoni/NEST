import { createClient } from "@supabase/supabase-js";

/** Bypasses every row-level security policy. Server-side only — never import
 *  this from a component that runs in the browser. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
