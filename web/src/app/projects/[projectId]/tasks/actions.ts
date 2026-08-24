"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createTask(projectId: string, formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const priority = String(formData.get("priority") || "medium");
  const assigneeId = String(formData.get("assignee_id") || "") || null;
  const dueDate = String(formData.get("due_date") || "") || null;

  if (!title) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("tasks").insert({
    project_id: projectId,
    title,
    description: description || null,
    priority,
    assignee_id: assigneeId,
    due_date: dueDate,
    created_by: user.id,
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function toggleTaskDone(
  taskId: string,
  projectId: string,
  done: boolean
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: done ? "done" : "todo" })
    .eq("id", taskId);

  revalidatePath(`/projects/${projectId}`);
  return { error: error?.message ?? null };
}

export async function deleteTask(projectId: string, formData: FormData) {
  const taskId = String(formData.get("task_id") || "");
  if (!taskId) return;

  const supabase = createClient();
  await supabase.from("tasks").delete().eq("id", taskId);
  revalidatePath(`/projects/${projectId}`);
}
