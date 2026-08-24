"""Supabase-backed helpers for the Slack bot.

Design note: this module talks to Supabase using the service_role key
(trusted, server-side only -- never exposed to Slack users or the browser).
That key bypasses Row Level Security entirely, so unlike the Next.js web
app (which uses the anon key + a logged-in user's session and therefore
gets RLS enforcement for free), every function here that answers on behalf
of a specific Slack user must explicitly scope its query to that user's
project_members rows in Python. That scoping *is* the access-control
boundary on this connection -- see spec.html section "設計上の重要な決定".
"""

import logging
import os
import random
import string
from datetime import date, datetime, timedelta, timezone

from postgrest.exceptions import APIError
from supabase import Client, create_client

logger = logging.getLogger("slack-claude-bot.supabase")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

LINK_CODE_ALPHABET = string.ascii_uppercase + string.digits
LINK_CODE_LENGTH = 6
LINK_CODE_TTL_MINUTES = 5

_UNIQUE_VIOLATION = "23505"

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError(
                "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません。"
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _client


# =====================================================================
# Slackユーザー ⇄ Supabaseユーザーの紐付け
# =====================================================================


def create_link_code(slack_user_id: str, slack_team_id: str) -> str:
    """`/link` コマンド用のワンタイムコードを発行し、Webアプリでの引き換え待ちとして保存する。"""
    client = get_client()
    code = "".join(random.choices(LINK_CODE_ALPHABET, k=LINK_CODE_LENGTH))
    expires_at = (
        datetime.now(timezone.utc) + timedelta(minutes=LINK_CODE_TTL_MINUTES)
    ).isoformat()
    client.table("slack_link_requests").insert(
        {
            "code": code,
            "slack_user_id": slack_user_id,
            "slack_team_id": slack_team_id,
            "expires_at": expires_at,
        }
    ).execute()
    return code


def find_linked_user(slack_user_id: str) -> dict | None:
    """このSlackユーザーIDに紐付くprofilesの{id, email, display_name}を返す。未紐付けならNone。"""
    client = get_client()
    res = (
        client.table("slack_links")
        .select("user_id, profiles(id, email, display_name)")
        .eq("slack_user_id", slack_user_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows or not rows[0].get("profiles"):
        return None
    return rows[0]["profiles"]


# =====================================================================
# プロジェクト/タスクのCRUD
#
# RLSはこの接続(service_role)では効かないため、"created_by/owner_idが実際に
# そのプロジェクトのメンバーか" のような、本来Webアプリ側ならRLSが担う検証は
# ここのPythonコードで行う。
# =====================================================================


def _is_project_member(client: Client, project_id: str, user_id: str) -> bool:
    res = (
        client.table("project_members")
        .select("user_id")
        .eq("project_id", project_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return bool(res.data)


def add_project(owner_id: str, name: str, description: str | None = None) -> dict | None:
    """新規プロジェクトを作成する。

    作成者(owner_id)はDBトリガー(handle_new_project)によってproject_membersに
    role='owner'として自動追加される(Webアプリ側のプロジェクト作成と同じ経路)。
    owner_idはprofiles(id)への外部キーなので、実在するユーザーでなければ
    外部キー制約エラーになる。
    """
    client = get_client()
    res = (
        client.table("projects")
        .insert({"name": name, "description": description, "owner_id": owner_id})
        .execute()
    )
    return res.data[0] if res.data else None


def list_projects_for_user(user_id: str) -> list[dict]:
    """このユーザーが参加している(project_membersに存在する)プロジェクトの一覧を返す。"""
    client = get_client()
    res = (
        client.table("project_members")
        .select("role, projects(id, name, description, status, created_at)")
        .eq("user_id", user_id)
        .execute()
    )
    projects = []
    for row in res.data or []:
        project = row.get("projects")
        if not project:
            continue
        projects.append({**project, "your_role": row["role"]})
    return projects


_VALID_TASK_STATUSES = {"todo", "in_progress", "done"}


def add_task(
    project_id: str,
    title: str,
    created_by: str,
    description: str | None = None,
    priority: str = "medium",
    assignee_id: str | None = None,
    due_date: str | None = None,
) -> dict | None:
    """タスクを追加する。created_by(・assignee_idを指定する場合はそれも)が
    project_membersに存在しない場合はPermissionErrorを投げる(tasks_insert/
    tasks_updateのRLS with checkと同じ制約をservice_role接続側で再現している)。
    """
    client = get_client()
    if not _is_project_member(client, project_id, created_by):
        raise PermissionError("created_byはこのプロジェクトのメンバーではありません")
    if assignee_id and not _is_project_member(client, project_id, assignee_id):
        raise PermissionError("assignee_idはこのプロジェクトのメンバーではありません")

    res = (
        client.table("tasks")
        .insert(
            {
                "project_id": project_id,
                "title": title,
                "description": description,
                "priority": priority,
                "assignee_id": assignee_id,
                "due_date": due_date,
                "created_by": created_by,
            }
        )
        .execute()
    )
    return res.data[0] if res.data else None


def list_tasks_for_project(project_id: str) -> list[dict]:
    """指定プロジェクトのタスク一覧を期日昇順(未設定は最後)で返す。"""
    client = get_client()
    res = (
        client.table("tasks")
        .select("id, project_id, title, description, status, priority, due_date, assignee_id")
        .eq("project_id", project_id)
        .order("due_date", desc=False, nullsfirst=False)
        .execute()
    )
    return res.data or []


def update_task_status(task_id: str, status: str) -> dict | None:
    """タスクのステータスを変更する(todo/in_progress/done)。"""
    if status not in _VALID_TASK_STATUSES:
        raise ValueError(f"不正なstatus: {status!r} (有効な値: {sorted(_VALID_TASK_STATUSES)})")
    client = get_client()
    res = client.table("tasks").update({"status": status}).eq("id", task_id).execute()
    return res.data[0] if res.data else None


# =====================================================================
# Q&A: 質問者が参照可能なプロジェクト/タスク/メンバーの束を取得する
# =====================================================================


def get_context_bundle(user_id: str) -> dict:
    """質問者(user_id)が参加しているプロジェクトについて、メンバーとタスクをまとめて返す。

    ここで project_members.user_id = user_id という条件で絞り込むことが、
    このユーザーが見てよい範囲の唯一の境界線になっている(§5のロールは閲覧範囲を
    区別しないため、参加していればowner/admin/memberいずれも同じ閲覧範囲)。
    """
    client = get_client()

    membership_res = (
        client.table("project_members")
        .select("project_id, role")
        .eq("user_id", user_id)
        .execute()
    )
    memberships = membership_res.data or []
    project_ids = [m["project_id"] for m in memberships]
    role_by_project = {m["project_id"]: m["role"] for m in memberships}

    if not project_ids:
        return {"projects": []}

    projects_res = (
        client.table("projects")
        .select("id, name, description, status")
        .in_("id", project_ids)
        .execute()
    )

    members_res = (
        client.table("project_members")
        .select("project_id, role, profiles(display_name, email)")
        .in_("project_id", project_ids)
        .execute()
    )

    tasks_res = (
        client.table("tasks")
        .select("id, project_id, title, status, priority, due_date, assignee_id")
        .in_("project_id", project_ids)
        .execute()
    )
    tasks = tasks_res.data or []

    assignee_ids = sorted({t["assignee_id"] for t in tasks if t.get("assignee_id")})
    assignee_names: dict[str, str] = {}
    if assignee_ids:
        assignees_res = (
            client.table("profiles")
            .select("id, display_name")
            .in_("id", assignee_ids)
            .execute()
        )
        assignee_names = {row["id"]: row["display_name"] for row in (assignees_res.data or [])}

    members_by_project: dict[str, list] = {}
    for row in members_res.data or []:
        profile = row.get("profiles") or {}
        members_by_project.setdefault(row["project_id"], []).append(
            {"display_name": profile.get("display_name"), "role": row["role"]}
        )

    tasks_by_project: dict[str, list] = {}
    for t in tasks:
        tasks_by_project.setdefault(t["project_id"], []).append(
            {
                "title": t["title"],
                "status": t["status"],
                "priority": t["priority"],
                "due_date": t["due_date"],
                "assignee": assignee_names.get(t["assignee_id"]),
            }
        )

    projects = []
    for p in projects_res.data or []:
        pid = p["id"]
        projects.append(
            {
                "name": p["name"],
                "description": p.get("description"),
                "status": p["status"],
                "your_role": role_by_project.get(pid),
                "members": members_by_project.get(pid, []),
                "tasks": tasks_by_project.get(pid, []),
            }
        )

    return {"projects": projects}


_TASK_STATUS_LABELS = {"todo": "未対応", "in_progress": "進行中", "done": "完了"}


def find_project_by_name_in_text(user_id: str, text: str) -> dict | None:
    """質問文(text)にこのユーザーが参加しているプロジェクトの名前が
    (部分文字列として)含まれていれば、そのプロジェクトを返す。
    複数該当する場合は最初に見つかったものを返し、無ければNone。
    """
    for project in list_projects_for_user(user_id):
        name = project.get("name")
        if name and name in text:
            return project
    return None


def describe_project(project: dict) -> str:
    """プロジェクトの概要とタスク一覧を日本語の文章として組み立てる。"""
    tasks = list_tasks_for_project(project["id"])

    lines = [f"『{project['name']}』の概要"]
    if project.get("description"):
        lines.append(project["description"])
    lines.append("状態: " + ("アーカイブ済み" if project.get("status") == "archived" else "進行中"))
    lines.append("")

    if not tasks:
        lines.append("タスクはまだ登録されていません。")
    else:
        lines.append(f"タスク一覧({len(tasks)}件):")
        for t in tasks:
            status_label = _TASK_STATUS_LABELS.get(t["status"], t["status"])
            due = f" / 期日: {t['due_date']}" if t.get("due_date") else ""
            lines.append(f"- {t['title']} [{status_label}]{due}")

    return "\n".join(lines)


def answer_question_about_project(user_id: str, question: str) -> str | None:
    """質問文にこのユーザーが参加しているプロジェクト名が含まれていれば、
    その概要とタスク一覧を文章として返す(Claudeを介さない直接応答用)。
    見つからなければNoneを返す -- 呼び出し側は他の経路(Claude+コンテキスト等)に
    フォールバックすること。
    """
    project = find_project_by_name_in_text(user_id, question)
    if project is None:
        return None
    return describe_project(project)


# =====================================================================
# 期日アラート
# =====================================================================

_KIND_LABELS = {
    "due_soon": "明日が期日です",
    "due_today": "本日が期日です",
    "overdue": "期日を超過しています",
}


def _classify(due: date, today: date) -> str | None:
    if due < today:
        return "overdue"
    if due == today:
        return "due_today"
    if due == today + timedelta(days=1):
        return "due_soon"
    return None


def _try_claim_notification(client: Client, task_id: str, kind: str, due_date: str) -> bool:
    """このタスク・種別・期日の組で初回なら通知ログを作成してTrueを返す(=送信してよい)。

    既に送信済みならnotification_logsのunique制約で失敗し、Falseを返す。
    """
    try:
        client.table("notification_logs").insert(
            {"task_id": task_id, "type": kind, "due_date": due_date}
        ).execute()
        return True
    except APIError as exc:
        if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
            return False
        logger.exception("failed to claim notification for task %s", task_id)
        return False


def get_due_alerts(today: date | None = None) -> list[dict]:
    """本日時点で新規に送信すべき期日アラートを集めて返す(送信自体は呼び出し側=app.pyが行う)。

    戻り値は各タスクについて:
      {kind, task: {id, title, due_date, project_name}, channel_ids: [...], assignee_slack_id: str|None}
    """
    client = get_client()
    today = today or datetime.now(timezone.utc).date()
    horizon = today + timedelta(days=1)

    tasks_res = (
        client.table("tasks")
        .select("id, project_id, title, due_date, assignee_id")
        .neq("status", "done")
        .lte("due_date", horizon.isoformat())
        .execute()
    )
    tasks = tasks_res.data or []
    if not tasks:
        return []

    project_ids = sorted({t["project_id"] for t in tasks})
    assignee_ids = sorted({t["assignee_id"] for t in tasks if t.get("assignee_id")})

    projects_res = (
        client.table("projects").select("id, name").in_("id", project_ids).execute()
    )
    project_names = {p["id"]: p["name"] for p in (projects_res.data or [])}

    channels_res = (
        client.table("project_slack_channels")
        .select("project_id, slack_channel_id")
        .eq("notify_due_date", True)
        .in_("project_id", project_ids)
        .execute()
    )
    channels_by_project: dict[str, list[str]] = {}
    for row in channels_res.data or []:
        channels_by_project.setdefault(row["project_id"], []).append(row["slack_channel_id"])

    assignee_slack_ids: dict[str, str] = {}
    if assignee_ids:
        links_res = (
            client.table("slack_links")
            .select("user_id, slack_user_id")
            .in_("user_id", assignee_ids)
            .execute()
        )
        assignee_slack_ids = {row["user_id"]: row["slack_user_id"] for row in (links_res.data or [])}

    alerts = []
    for t in tasks:
        due = date.fromisoformat(t["due_date"])
        kind = _classify(due, today)
        if kind is None:
            continue
        if not _try_claim_notification(client, t["id"], kind, t["due_date"]):
            continue
        alerts.append(
            {
                "kind": kind,
                "label": _KIND_LABELS[kind],
                "task": {
                    "id": t["id"],
                    "title": t["title"],
                    "due_date": t["due_date"],
                    "project_name": project_names.get(t["project_id"], "(不明なプロジェクト)"),
                },
                "channel_ids": channels_by_project.get(t["project_id"], []),
                "assignee_slack_id": assignee_slack_ids.get(t["assignee_id"]) if t.get("assignee_id") else None,
            }
        )

    return alerts


def get_unnotified_due_tasks(today: date | None = None) -> list[dict]:
    """今日以前が期日で未完了・未通知のタスクを取得する(読み取り専用、通知は
    記録しない)。

    get_due_alerts()との違い: get_due_alerts()は「取得と同時にnotification_logsへ
    記録(claim)」まで一体で行う実運用のアラート送信バッチ用で、明日期日
    (due_soon)も含む。この関数は講義要件どおりの単純な二段階フロー
    (取得 → 通知を送る → mark_task_notified()で明示的に記録する)向けに、
    「今日以前」だけを対象にした素朴な版として用意している。
    """
    client = get_client()
    today = today or datetime.now(timezone.utc).date()

    tasks_res = (
        client.table("tasks")
        .select("id, project_id, title, due_date, assignee_id, status")
        .neq("status", "done")
        .lte("due_date", today.isoformat())
        .execute()
    )
    tasks = tasks_res.data or []
    if not tasks:
        return []

    task_ids = [t["id"] for t in tasks]
    notified_res = (
        client.table("notification_logs")
        .select("task_id")
        .in_("task_id", task_ids)
        .execute()
    )
    already_notified = {row["task_id"] for row in (notified_res.data or [])}

    return [t for t in tasks if t["id"] not in already_notified]


def mark_task_notified(task_id: str, due_date: str, kind: str = "overdue") -> bool:
    """タスクを通知済みとして記録する。get_unnotified_due_tasks()と対にして使う
    明示的な「通知済みフラグの更新」用API(get_due_alerts()は内部でこの記録も
    一緒に行うため、通常はこちらを別途呼ぶ必要はない)。
    """
    if kind not in _KIND_LABELS:
        raise ValueError(f"不正なkind: {kind!r} (有効な値: {sorted(_KIND_LABELS)})")
    client = get_client()
    return _try_claim_notification(client, task_id, kind, due_date)
