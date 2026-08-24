import { removeMember } from "@/app/projects/[projectId]/members/actions";
import type { ProjectMember } from "@/lib/types";

export function MemberList({
  projectId,
  members,
  isAdmin,
  currentUserId,
}: {
  projectId: string;
  members: ProjectMember[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  const removeAction = removeMember.bind(null, projectId);

  return (
    <ul className="flex flex-col gap-2">
      {members.map((m) => (
        <li
          key={m.user_id}
          className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-2"
        >
          <div>
            <p className="font-medium">{m.profiles?.display_name ?? m.user_id}</p>
            <p className="text-xs text-gray-500">{m.profiles?.email}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">{m.role}</span>
            {isAdmin && m.role !== "owner" && m.user_id !== currentUserId && (
              <form action={removeAction}>
                <input type="hidden" name="user_id" value={m.user_id} />
                <button type="submit" className="text-status-risk">
                  削除
                </button>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
