"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// サイドバー下部の簡易フォーム用。詳細な説明はプロジェクト設定画面から
// 後で追加できるので、ここでは名前だけを受け取る。
export async function createProjectQuick(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("projects")
    .insert({ name, owner_id: user.id })
    .select("id")
    .single();

  if (error || !data) {
    console.warn("createProjectQuick: failed to create project", error?.message);
    return;
  }

  // "layout" revalidateはサイドバーのプロジェクト一覧を再取得させるため。
  revalidatePath("/projects", "layout");
  redirect(`/projects/${data.id}`);
}
