import { createBrowserClient } from "@supabase/ssr";

/** For components that run in the browser. Reads the session from cookies
 *  the middleware keeps fresh. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
