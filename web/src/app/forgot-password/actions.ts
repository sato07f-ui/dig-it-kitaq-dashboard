"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "");
  const supabase = createClient();

  // Result is intentionally not surfaced to the caller: revealing whether an
  // email exists would let anyone probe the user list.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });

  redirect("/forgot-password/sent");
}
