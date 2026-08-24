import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  updateProject,
  archiveProject,
  unarchiveProject,
  deleteProject,
  addSlackChannel,
  removeSlackChannel,
} from "./actions";

export default async function ProjectSettingsPage({ params }: { params: { projectId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description, status, owner_id")
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
  const isOwner = membership?.role === "owner";

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-gray-500">この画面はプロジェクトのowner/adminのみ利用できます。</p>
      </main>
    );
  }

  const { data: channels } = await supabase
    .from("project_slack_channels")
    .select("id, slack_channel_id, notify_due_date")
    .eq("project_id", project.id);

  const updateAction = updateProject.bind(null, project.id);
  const archiveAction = archiveProject.bind(null, project.id);
  const unarchiveAction = unarchiveProject.bind(null, project.id);
  const deleteAction = deleteProject.bind(null, project.id);
  const addChannelAction = addSlackChannel.bind(null, project.id);
  const removeChannelAction = removeSlackChannel.bind(null, project.id);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
        <div>
          <h1 className="mb-4 text-2xl font-bold">プロジェクト設定</h1>
          <form action={updateAction} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <input
              name="name"
              defaultValue={project.name}
              required
              className="rounded-md border border-gray-300 px-3 py-2"
            />
            <textarea
              name="description"
              defaultValue={project.description ?? ""}
              rows={3}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
            <button type="submit" className="self-start rounded-md bg-accent px-4 py-2 text-sm text-white">
              保存
            </button>
          </form>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Slack通知チャンネル</h2>
          <p className="mb-3 text-sm text-gray-500">
            ここに登録したチャンネルへ、このプロジェクトのタスクの期日アラートが送信されます。
          </p>
          <ul className="mb-3 flex flex-col gap-2">
            {(channels ?? []).map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-2 text-sm"
              >
                <span>{c.slack_channel_id}</span>
                <form action={removeChannelAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="text-status-risk">
                    削除
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addChannelAction} className="flex gap-3">
            <input
              name="slack_channel_id"
              placeholder="SlackチャンネルID (例: C0123456789)"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2"
            />
            <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm text-white">
              追加
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-lg font-semibold text-status-risk">危険な操作</h2>
          <form action={project.status === "active" ? archiveAction : unarchiveAction}>
            <button
              type="submit"
              className="rounded-md border border-status-risk px-4 py-2 text-sm text-status-risk"
            >
              {project.status === "active" ? "アーカイブする" : "アーカイブを解除する"}
            </button>
          </form>
          {isOwner && (
            <form action={deleteAction}>
              <button type="submit" className="rounded-md bg-status-risk px-4 py-2 text-sm text-white">
                プロジェクトを削除する
              </button>
            </form>
          )}
        </div>
    </main>
  );
}
