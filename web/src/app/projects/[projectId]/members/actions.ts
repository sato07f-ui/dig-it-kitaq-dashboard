"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function inviteMember(projectId: string, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "member");
  if (!email) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({ project_id: projectId, email, role, invited_by: user.id })
    .select("token")
    .single();

  if (error || !invitation) {
    console.warn("inviteMember: failed to create invitation row", error?.message);
    revalidatePath(`/projects/${projectId}/members`);
    return;
  }

  const admin = createAdminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/invite/${invitation.token}`;
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

  // inviteError fires (and is intentionally swallowed) when the email
  // already has an account -- that user sees the pending invitation once
  // they log in, via invitations_select's `email = auth.email()` branch.
  if (inviteError) {
    console.warn("inviteUserByEmail:", inviteError.message);
  }

  revalidatePath(`/projects/${projectId}/members`);
}

export async function removeMember(projectId: string, formData: FormData) {
  const userId = String(formData.get("user_id") || "");
  if (!userId) return;

  const supabase = createClient();
  await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", userId);
  revalidatePath(`/projects/${projectId}/members`);
}

export async function revokeInvitation(projectId: string, formData: FormData) {
  const invitationId = String(formData.get("invitation_id") || "");
  if (!invitationId) return;

  const supabase = createClient();
  await supabase.from("invitations").delete().eq("id", invitationId);
  revalidatePath(`/projects/${projectId}/members`);
}
