"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function redeemCode(formData: FormData) {
  const code = String(formData.get("code") || "").trim().toUpperCase();
  if (!code) redirect(`/settings/slack?error=${encodeURIComponent("コードを入力してください")}`);

  const supabase = createClient();
  const { error } = await supabase.rpc("redeem_slack_link", { p_code: code });

  if (error) {
    redirect(`/settings/slack?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/settings/slack?linked=1");
}

export async function unlinkSlack() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("slack_links").delete().eq("user_id", user.id);
  }
  redirect("/settings/slack");
}
