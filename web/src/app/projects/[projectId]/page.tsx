import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TaskForm } from "@/components/TaskForm";
import { TaskBoard } from "@/components/TaskBoard";
import type { ProjectMember, Task } from "@/lib/types";

export default async function ProjectDetailPage({ params }: { params: { projectId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description, status")
    .eq("id", params.projectId)
    .single();
  if (!project) notFound();

  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", project.id)
    .eq("user_id", user.id)
    .single();

  const { data: rawMembers } = await supabase
    .from("project_members")
    .select("id, project_id, user_id, role, profiles(display_name, email)")
    .eq("project_id", project.id);
  // supabase-jsはDatabase型を渡していないため、多対一の埋め込み(profiles)の
  // カーディナリティを推測できず配列型を返す。実行時は常に1件のオブジェクトなので
  // ここで一度だけ正規の形へキャストする。
  const members = (rawMembers ?? []) as unknown as ProjectMember[];

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", project.id)
    .order("due_date", { ascending: true, nullsFirst: false });

  const isAdmin = membership?.role === "owner" || membership?.role === "admin";
  const owner = members.find((m) => m.role === "owner");
  const ownerName = owner?.profiles?.display_name ?? "不明";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{project.description || "概要は未設定です。"}</p>
        </div>
        <div className="flex shrink-0 gap-4 text-sm">
          <Link href={`/projects/${project.id}/members`} className="text-accent">
            メンバー
          </Link>
          {isAdmin && (
            <Link href={`/projects/${project.id}/settings`} className="text-accent">
              設定
            </Link>
          )}
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-3 text-sm">
        <span className="rounded-md border border-gray-200 bg-white px-3 py-1.5">
          責任者: <span className="font-medium">{ownerName}</span>
        </span>
        <span className="rounded-md border border-gray-200 bg-white px-3 py-1.5">
          状態:{" "}
          <span className="font-medium">
            {project.status === "archived" ? "アーカイブ済み" : "進行中"}
          </span>
        </span>
      </div>

      <TaskBoard
        projectId={project.id}
        tasks={(tasks ?? []) as Task[]}
        members={members}
        currentUserId={user.id}
        isAdmin={isAdmin}
      />

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">タスクを追加する</h2>
        <TaskForm projectId={project.id} members={members} />
      </div>
    </div>
  );
}
