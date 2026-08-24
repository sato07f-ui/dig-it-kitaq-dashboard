import Link from "next/link";
import { logout } from "@/app/logout/actions";

export function Nav() {
  return (
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <Link href="/projects" className="font-bold text-accent">
        プロジェクト管理
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/settings/slack" className="text-gray-600 hover:text-accent">
          Slack連携
        </Link>
        <form action={logout}>
          <button type="submit" className="text-gray-500 hover:text-gray-800">
            ログアウト
          </button>
        </form>
      </div>
    </nav>
  );
}
