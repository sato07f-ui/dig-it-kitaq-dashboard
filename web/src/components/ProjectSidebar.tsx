"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createProjectQuick } from "@/app/projects/actions";
import type { Project, Role } from "@/lib/types";

export function ProjectSidebar({ projects }: { projects: (Project & { your_role: Role })[] }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex-1 overflow-y-auto p-3">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          プロジェクト
        </p>
        {projects.length === 0 && (
          <p className="px-2 text-sm text-gray-400">まだプロジェクトがありません</p>
        )}
        <nav className="flex flex-col gap-0.5">
          {projects.map((project) => {
            const href = `/projects/${project.id}`;
            const active = pathname === href;
            return (
              <Link
                key={project.id}
                href={href}
                className={`truncate rounded-md px-3 py-2 text-sm ${
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {project.name}
                {project.status === "archived" && (
                  <span className="ml-1 text-xs text-gray-400">(アーカイブ)</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <form
        action={createProjectQuick}
        className="flex flex-col gap-2 border-t border-gray-200 p-3"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          プロジェクト追加
        </p>
        <input
          name="name"
          placeholder="新しいプロジェクト名"
          required
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-3 py-1.5 text-sm text-white hover:opacity-90"
        >
          追加する
        </button>
      </form>
    </aside>
  );
}
