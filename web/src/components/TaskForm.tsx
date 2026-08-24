import { createTask } from "@/app/projects/[projectId]/tasks/actions";
import type { ProjectMember } from "@/lib/types";

export function TaskForm({
  projectId,
  members,
}: {
  projectId: string;
  members: ProjectMember[];
}) {
  const action = createTask.bind(null, projectId);

  return (
    <form
      action={action}
      className="mb-8 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <input
        name="title"
        placeholder="タスク名"
        required
        className="rounded-md border border-gray-300 px-3 py-2"
      />
      <textarea
        name="description"
        placeholder="詳細(任意)"
        rows={2}
        className="rounded-md border border-gray-300 px-3 py-2"
      />
      <div className="flex flex-wrap items-center gap-3">
        <select name="priority" defaultValue="medium" className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="low">優先度: 低</option>
          <option value="medium">優先度: 中</option>
          <option value="high">優先度: 高</option>
        </select>
        <select name="assignee_id" defaultValue="" className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">担当者未設定</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.profiles?.display_name ?? m.user_id}
            </option>
          ))}
        </select>
        <input type="date" name="due_date" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <button type="submit" className="ml-auto rounded-md bg-accent px-4 py-2 text-sm text-white">
          追加
        </button>
      </div>
    </form>
  );
}
