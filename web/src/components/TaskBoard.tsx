"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleTaskDone, deleteTask } from "@/app/projects/[projectId]/tasks/actions";
import type { Task, ProjectMember } from "@/lib/types";

const PRIORITY_LABELS = { low: "低", medium: "中", high: "高" } as const;
const STATUS_LABELS = { todo: "未対応", in_progress: "進行中", done: "完了" } as const;

export function TaskBoard({
  projectId,
  tasks,
  members,
  currentUserId,
  isAdmin,
}: {
  projectId: string;
  tasks: Task[];
  members: ProjectMember[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // チェック直後に画面へすぐ反映するための一時的な上書き値。
  // サーバーの再検証(router.refresh)が終わればpropsのtasksと自然に一致する。
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const nameById = new Map(members.map((m) => [m.user_id, m.profiles?.display_name ?? m.user_id]));
  const today = new Date().toISOString().slice(0, 10);

  const isDone = (task: Task) => overrides[task.id] ?? task.status === "done";
  const doneCount = tasks.filter(isDone).length;
  const total = tasks.length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  function handleToggle(task: Task, checked: boolean) {
    setOverrides((prev) => ({ ...prev, [task.id]: checked }));
    startTransition(async () => {
      const { error } = await toggleTaskDone(task.id, projectId, checked);
      if (error) {
        setOverrides((prev) => ({ ...prev, [task.id]: !checked }));
      }
      router.refresh();
    });
  }

  const deleteAction = deleteTask.bind(null, projectId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 text-sm text-gray-600">
          {doneCount} / {total} 件 完了
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {tasks.length === 0 ? (
        <p className="text-gray-500">タスクはまだありません。</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="w-10 px-4 py-2" />
                <th className="px-4 py-2">タスク名</th>
                <th className="px-4 py-2">担当</th>
                <th className="px-4 py-2">期限</th>
                <th className="px-4 py-2">状態</th>
                {isAdmin && <th className="w-10 px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const done = isDone(task);
                const overdue = !!task.due_date && task.due_date < today && !done;
                const canEdit = isAdmin || task.assignee_id === currentUserId;

                return (
                  <tr key={task.id} className="border-t border-gray-100">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={done}
                        disabled={!canEdit}
                        onChange={(e) => handleToggle(task, e.target.checked)}
                        className="h-4 w-4 accent-accent disabled:opacity-40"
                        aria-label={`${task.title}を完了にする`}
                      />
                    </td>
                    <td className={`px-4 py-2 ${done ? "text-gray-400 line-through" : "text-gray-900"}`}>
                      <div>{task.title}</div>
                      <div className="text-xs text-gray-400">優先度: {PRIORITY_LABELS[task.priority]}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {task.assignee_id ? nameById.get(task.assignee_id) ?? "不明" : "未設定"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{task.due_date ?? "-"}</td>
                    <td className="px-4 py-2">
                      {overdue ? (
                        <span className="whitespace-nowrap rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-status-risk">
                          期日超過
                        </span>
                      ) : (
                        <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {STATUS_LABELS[done ? "done" : task.status]}
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2 text-right">
                        <form action={deleteAction}>
                          <input type="hidden" name="task_id" value={task.id} />
                          <button type="submit" className="text-gray-400 hover:text-status-risk">
                            削除
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
