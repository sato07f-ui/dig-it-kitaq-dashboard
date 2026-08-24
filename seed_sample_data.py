"""開発用: 実在するユーザー(メールアドレスで指定)に紐づくサンプルの
プロジェクト・タスクを作成する。

projects.owner_id / tasks.created_by / tasks.assignee_id はいずれも
profiles(id) への外部キー制約付きの参照であり、ランダムな架空のUUIDを
入れると外部キー制約エラーになる。そのため、このスクリプトは「Webアプリで
実際にサインアップ済み(email確認済み)のユーザーのメールアドレス」を
引数に取り、そのユーザー自身をowner/作成者/担当者としてサンプルデータを
作成する。該当ユーザーが見つからない場合は何も作らずに終了する。

使い方:
    python seed_sample_data.py you@example.com
"""

import sys
from datetime import date, timedelta

import bot_supabase


def _find_profile_by_email(email: str) -> dict | None:
    client = bot_supabase.get_client()
    res = (
        client.table("profiles")
        .select("id, email, display_name")
        .eq("email", email)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


def main() -> None:
    if len(sys.argv) != 2:
        print("使い方: python seed_sample_data.py <email>")
        sys.exit(1)

    email = sys.argv[1]
    profile = _find_profile_by_email(email)
    if profile is None:
        print(
            f"'{email}' に対応するprofilesが見つかりませんでした。"
            "外部キー制約違反を避けるため、ダミーIDでの作成はスキップします。\n"
            "先にWebアプリでサインアップ(メール確認含む)してから実行してください。"
        )
        sys.exit(1)

    user_id = profile["id"]
    today = date.today()

    project = bot_supabase.add_project(
        owner_id=user_id,
        name="サンプルプロジェクト",
        description="seed_sample_data.py で作成した動作確認用のプロジェクトです。",
    )
    if project is None:
        print("プロジェクトの作成に失敗しました。")
        sys.exit(1)

    print(f"プロジェクトを作成しました: {project['name']} ({project['id']})")

    # 期日アラート(due_soon/due_today/overdue)や一覧取得を一通り確認できるよう、
    # 期日のパターンを分けた5件のタスクを作成する。
    sample_tasks = [
        {"title": "サンプルタスク1(期日超過)", "due_date": today - timedelta(days=2)},
        {"title": "サンプルタスク2(本日期日)", "due_date": today},
        {"title": "サンプルタスク3(明日期日)", "due_date": today + timedelta(days=1)},
        {"title": "サンプルタスク4(期日未設定)", "due_date": None},
        {"title": "サンプルタスク5(完了済み)", "due_date": today - timedelta(days=5), "status": "done"},
    ]

    for spec in sample_tasks:
        due = spec["due_date"].isoformat() if spec.get("due_date") else None
        task = bot_supabase.add_task(
            project_id=project["id"],
            title=spec["title"],
            created_by=user_id,
            assignee_id=user_id,
            due_date=due,
        )
        if task is None:
            print(f"  - タスクの作成に失敗しました: {spec['title']}")
            continue

        status = spec.get("status")
        if status:
            bot_supabase.update_task_status(task["id"], status)

        print(f"  - タスクを作成しました: {spec['title']}")

    print("完了しました。")


if __name__ == "__main__":
    main()
