"use server";

import { createClient } from "@/lib/supabase/server";

export async function acceptInvitation(token: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  return { error: error?.message ?? null };
}
