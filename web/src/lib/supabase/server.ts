import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Components / Server Actions client: reads the logged-in user's
// session from cookies, so every query through this client is subject to
// the RLS policies in supabase/migrations/0001_init.sql as that user.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render (not an Action/Route
            // Handler) where cookies can't be written -- middleware.ts
            // refreshes the session on the next request instead.
          }
        },
      },
    }
  );
}
