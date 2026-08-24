"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProject(projectId: string, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (!name) return;

  const supabase = createClient();
  await supabase.from("projects").update({ name, description: description || null }).eq("id", projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function archiveProject(projectId: string) {
  const supabase = createClient();
  await supabase
    .from("projects")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
  revalidatePath("/projects");
}

export async function unarchiveProject(projectId: string) {
  const supabase = createClient();
  await supabase.from("projects").update({ status: "active", archived_at: null }).eq("id", projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
  revalidatePath("/projects");
}

export async function deleteProject(projectId: string) {
  const supabase = createClient();
  await supabase.from("projects").delete().eq("id", projectId);
  redirect("/projects");
}

export async function addSlackChannel(projectId: string, formData: FormData) {
  const channelId = String(formData.get("slack_channel_id") || "").trim();
  if (!channelId) return;

  const supabase = createClient();
  await supabase.from("project_slack_channels").insert({ project_id: projectId, slack_channel_id: channelId });
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function removeSlackChannel(projectId: string, formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;

  const supabase = createClient();
  await supabase.from("project_slack_channels").delete().eq("id", id);
  revalidatePath(`/projects/${projectId}/settings`);
}
