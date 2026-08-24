import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// service_role client -- bypasses Row Level Security entirely. Import this
// ONLY from server-only code (Server Actions, Route Handlers), and only for
// the one thing that genuinely needs elevated privilege: sending Supabase's
// built-in invite email via auth.admin.inviteUserByEmail. Every other write
// in this app goes through the RLS-scoped client in ./server.ts.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
