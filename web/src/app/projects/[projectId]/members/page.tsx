import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberList } from "@/components/MemberList";
import { InviteForm } from "@/components/InviteForm";
import { revokeInvitation } from "./actions";
import type { ProjectMember } from "@/lib/types";

export default async function MembersPage({ params }: { params: { projectId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", params.projectId)
    .single();
  if (!project) notFound();

  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", project.id)
    .eq("user_id", user.id)
    .single();
  const isAdmin = membership?.role === "owner" || membership?.role === "admin";

  const { data: rawMembers } = await supabase
    .from("project_members")
    .select("id, project_id, user_id, role, profiles(display_name, email)")
    .eq("project_id", project.id);
  // [projectId]/page.tsxと同じ理由(profilesの埋め込みカーディナリティを
  // supabase-jsが推測できない)でのキャスト。実行時は常に1件のオブジェクト。
  const members = (rawMembers ?? []) as unknown as ProjectMember[];

  const { data: invitations } = isAdmin
    ? await supabase
        .from("invitations")
        .select("id, email, role, status, expires_at")
        .eq("project_id", project.id)
        .eq("status", "pending")
    : { data: [] };

  const revokeAction = revokeInvitation.bind(null, project.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">{project.name} のメンバー</h1>

      <MemberList
        projectId={project.id}
        members={members}
        isAdmin={isAdmin}
        currentUserId={user.id}
      />

      {isAdmin && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-semibold">招待中</h2>
          {(invitations ?? []).length === 0 && (
            <p className="mb-6 text-sm text-gray-500">保留中の招待はありません。</p>
          )}
          {(invitations ?? []).length > 0 && (
            <ul className="mb-6 flex flex-col gap-2">
              {(invitations ?? []).map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-2 text-sm"
                >
                  <span>
                    {inv.email} ({inv.role})
                  </span>
                  <form action={revokeAction}>
                    <input type="hidden" name="invitation_id" value={inv.id} />
                    <button type="submit" className="text-status-risk">
                      取り消す
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <InviteForm projectId={project.id} />
        </>
      )}
    </main>
  );
}
