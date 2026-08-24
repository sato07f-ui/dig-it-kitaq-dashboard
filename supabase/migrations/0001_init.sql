-- プロジェクト管理システム 初期スキーマ
-- 適用方法: SupabaseダッシュボードのSQL Editorでこのファイルの内容をそのまま実行する。
-- (Supabase CLIを使う場合は `supabase db push` でも適用可能)

create extension if not exists pgcrypto;

-- =========================================================
-- テーブル
-- =========================================================

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  display_name text not null,
  created_at   timestamptz not null default now()
);

create table projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  status       text not null default 'active' check (status in ('active', 'archived')),
  owner_id     uuid not null references profiles(id),
  created_at   timestamptz not null default now(),
  archived_at  timestamptz
);

create table project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       text not null check (role in ('owner', 'admin', 'member')),
  joined_at  timestamptz not null default now(),
  unique (project_id, user_id)
);

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority    text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assignee_id uuid references profiles(id),
  due_date    date,
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table invitations (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  email       text not null,
  role        text not null check (role in ('admin', 'member')),
  invited_by  uuid not null references profiles(id),
  token       uuid not null unique default gen_random_uuid(),
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '7 days')
);

-- Slackユーザー ⇄ Supabaseユーザーの紐付け
create table slack_links (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references profiles(id) on delete cascade,
  slack_user_id text not null,
  slack_team_id text not null,
  linked_at     timestamptz not null default now(),
  unique (slack_user_id, slack_team_id)
);

-- `/link` コマンドが発行するワンタイムコード（短命・Webアプリでの入力待ち）
create table slack_link_requests (
  code          text primary key,
  slack_user_id text not null,
  slack_team_id text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '5 minutes')
);

-- プロジェクトごとの通知先Slackチャンネル
create table project_slack_channels (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  slack_channel_id text not null,
  notify_due_date  boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (project_id, slack_channel_id)
);

-- 期日アラートの重複送信防止ログ（due_dateを含めて一意にし、期日変更後の再通知を許容する）
create table notification_logs (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  type        text not null check (type in ('due_soon', 'due_today', 'overdue')),
  due_date    date not null,
  notified_at timestamptz not null default now(),
  unique (task_id, type, due_date)
);

-- =========================================================
-- インデックス
-- =========================================================

create index idx_tasks_project_id on tasks(project_id);
create index idx_tasks_assignee_id on tasks(assignee_id);
create index idx_tasks_due_date_open on tasks(due_date) where status <> 'done';
create index idx_project_members_user_id on project_members(user_id);
create index idx_project_members_project_id on project_members(project_id);
create index idx_invitations_project_id on invitations(project_id);
create index idx_invitations_email on invitations(email);
create index idx_notification_logs_task_id on notification_logs(task_id);

-- =========================================================
-- RLS用ヘルパー関数（security definerでproject_membersへの
-- 自己参照ポリシーによる無限再帰を避ける）
-- =========================================================

create or replace function is_project_member(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = p_user_id
  );
$$;

create or replace function is_project_admin(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = p_user_id and role in ('owner', 'admin')
  );
$$;

create or replace function shares_project_with(p_other_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from project_members pm1
    join project_members pm2 on pm1.project_id = pm2.project_id
    where pm1.user_id = auth.uid() and pm2.user_id = p_other_user
  );
$$;

grant execute on function is_project_member(uuid, uuid) to authenticated;
grant execute on function is_project_admin(uuid, uuid) to authenticated;
grant execute on function shares_project_with(uuid) to authenticated;

-- =========================================================
-- RLS 有効化 + ポリシー
-- =========================================================

alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table tasks enable row level security;
alter table invitations enable row level security;
alter table slack_links enable row level security;
alter table slack_link_requests enable row level security;
alter table project_slack_channels enable row level security;
alter table notification_logs enable row level security;

-- profiles: 本人 or 同じプロジェクトに参加しているユーザーのみ参照可
create policy "profiles_select" on profiles for select
  using (auth.uid() = id or shares_project_with(id));

create policy "profiles_update_self" on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- projects
-- owner_id = auth.uid() は、is_project_member()単独では拾えない一瞬のタイミング差
-- (INSERT ... RETURNING時、作成者をproject_membersに追加するトリガーの実行順序に
-- よってはまだ自分のメンバー行が見えない)を確実にカバーするために付けている。
create policy "projects_select" on projects for select
  using (is_project_member(id, auth.uid()) or owner_id = auth.uid());

create policy "projects_insert" on projects for insert
  with check (owner_id = auth.uid());

create policy "projects_update" on projects for update
  using (is_project_admin(id, auth.uid()));

create policy "projects_delete" on projects for delete
  using (owner_id = auth.uid());

-- project_members（insertはトリガー/RPC経由のみ。直接のinsertポリシーは設けない）
create policy "project_members_select" on project_members for select
  using (is_project_member(project_id, auth.uid()));

create policy "project_members_update" on project_members for update
  using (is_project_admin(project_id, auth.uid()));

create policy "project_members_delete" on project_members for delete
  using (is_project_admin(project_id, auth.uid()));

-- tasks
create policy "tasks_select" on tasks for select
  using (is_project_member(project_id, auth.uid()));

create policy "tasks_insert" on tasks for insert
  with check (is_project_member(project_id, auth.uid()) and created_by = auth.uid());

create policy "tasks_update" on tasks for update
  using (is_project_admin(project_id, auth.uid()) or assignee_id = auth.uid());

create policy "tasks_delete" on tasks for delete
  using (is_project_admin(project_id, auth.uid()));

-- invitations
create policy "invitations_select" on invitations for select
  using (is_project_admin(project_id, auth.uid()) or email = auth.email());

create policy "invitations_insert" on invitations for insert
  with check (is_project_admin(project_id, auth.uid()) and invited_by = auth.uid());

create policy "invitations_update" on invitations for update
  using (is_project_admin(project_id, auth.uid()));

create policy "invitations_delete" on invitations for delete
  using (is_project_admin(project_id, auth.uid()));

-- slack_links（insert/updateはredeem_slack_link RPC経由のみ）
create policy "slack_links_select" on slack_links for select
  using (user_id = auth.uid());

create policy "slack_links_delete" on slack_links for delete
  using (user_id = auth.uid());

-- project_slack_channels
create policy "project_slack_channels_select" on project_slack_channels for select
  using (is_project_member(project_id, auth.uid()));

create policy "project_slack_channels_insert" on project_slack_channels for insert
  with check (is_project_admin(project_id, auth.uid()));

create policy "project_slack_channels_update" on project_slack_channels for update
  using (is_project_admin(project_id, auth.uid()));

create policy "project_slack_channels_delete" on project_slack_channels for delete
  using (is_project_admin(project_id, auth.uid()));

-- slack_link_requests / notification_logs:
-- ポリシーを設けない = クライアント(anon/authenticated)からは一切アクセス不可。
-- Slack bot は service_role キー(RLSをバイパス)でのみアクセスする内部テーブル。

-- =========================================================
-- トリガー
-- =========================================================

-- auth.users への新規登録時、profiles行を自動作成する
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- プロジェクト作成時、作成者を project_members に owner として自動追加する
-- (これを忘れると、作成者自身がRLS上そのプロジェクトを参照できなくなる)
create or replace function handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_project_created
  after insert on projects
  for each row execute function handle_new_project();

-- tasks.updated_at の自動更新
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- =========================================================
-- RPC関数（クライアントから直接INSERTさせず、検証を伴う操作を集約する）
-- =========================================================

-- 招待受諾: トークンの有効期限・メール一致を検証してproject_membersへ追加する
create or replace function accept_invitation(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation invitations;
begin
  select * into v_invitation from invitations where token = p_token;

  if v_invitation is null then
    raise exception 'invitation_not_found';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'invitation_already_used';
  end if;

  if v_invitation.expires_at < now() then
    update invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'invitation_expired';
  end if;

  if v_invitation.email <> auth.email() then
    raise exception 'invitation_email_mismatch';
  end if;

  insert into project_members (project_id, user_id, role)
  values (v_invitation.project_id, auth.uid(), v_invitation.role)
  on conflict (project_id, user_id) do nothing;

  update invitations set status = 'accepted' where id = v_invitation.id;
end;
$$;

grant execute on function accept_invitation(uuid) to authenticated;

-- Slack連携コードの引き換え: ログイン中ユーザー自身の操作としてslack_linksへ書き込む
create or replace function redeem_slack_link(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req slack_link_requests;
begin
  select * into v_req from slack_link_requests where code = p_code;

  if v_req is null then
    raise exception 'code_not_found';
  end if;

  if v_req.expires_at < now() then
    delete from slack_link_requests where code = p_code;
    raise exception 'code_expired';
  end if;

  insert into slack_links (user_id, slack_user_id, slack_team_id)
  values (auth.uid(), v_req.slack_user_id, v_req.slack_team_id)
  on conflict (user_id) do update
    set slack_user_id = excluded.slack_user_id,
        slack_team_id = excluded.slack_team_id,
        linked_at = now();

  delete from slack_link_requests where code = p_code;
end;
$$;

grant execute on function redeem_slack_link(text) to authenticated;
