import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** For server components, route handlers and server actions.
 *
 *  Server components cannot set cookies, so the write path is allowed to
 *  fail silently — the middleware is what actually refreshes the session.
 *  Without that try/catch, every server component render throws. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a server component. The middleware handles refresh.
          }
        },
      },
    },
  );
}
