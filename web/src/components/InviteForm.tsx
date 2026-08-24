import { inviteMember } from "@/app/projects/[projectId]/members/actions";

export function InviteForm({ projectId }: { projectId: string }) {
  const action = inviteMember.bind(null, projectId);

  return (
    <form action={action} className="flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <input
        type="email"
        name="email"
        placeholder="メールアドレス"
        required
        className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-2"
      />
      <select name="role" defaultValue="member" className="rounded-md border border-gray-300 px-3 py-2">
        <option value="member">member</option>
        <option value="admin">admin</option>
      </select>
      <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm text-white">
        招待を送る
      </button>
    </form>
  );
}
