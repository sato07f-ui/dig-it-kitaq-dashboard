# slack-claude-bot

Claude Code CLI をエージェントとして起動し、Slack でのやり取りに応答する Bot です。

このリポジトリには2つの部分があります:

- **`web/`**: プロジェクト・タスク・メンバー管理を行うNext.js製Webアプリ(Supabaseメール認証)
- **ルートの`app.py`ほか**: 期日アラート通知とQ&A応答を行うSlack bot(このセクション以下は元々こちらの説明です)

Web/Slack bot共通のバックエンドはSupabaseです。セットアップ手順は[Supabaseプロジェクトのセットアップ](#supabaseプロジェクトのセットアップ)と[Webアプリのセットアップ](#webアプリのセットアップ)を参照してください。

**ANTHROPIC_API_KEY は一切使用しません。** 回答生成は `claude -p "<質問>"` をサブプロセスとして呼び出すことで行い、認証はあらかじめ `claude` にログイン済みの Claude.ai サブスクリプション(Pro/Max/Team)を利用します。

デフォルトではチャット専用モードで動作します(`permission-settings.json` で Bash/Read/Write/Edit/Glob/Grep/WebFetch/WebSearch などの全ツールを deny)。Slack 経由でファイル操作やコマンド実行をさせたくない場合の安全な構成です。

## 前提条件

- Python 3.10 以上
- Claude Code CLI(Pro/Max/Team/Enterprise のいずれかのアカウントでログイン済み)

## セットアップ

### 1. Claude Code CLI をインストール・ログイン

PowerShell で:

```powershell
irm https://claude.ai/install.ps1 | iex
```

インストール後、一度対話的に起動してブラウザ経由でログインします(このステップだけは対話操作が必要です):

```powershell
claude
```

ログインが終わったら `claude --version` で動作確認してください。Bot はこのログイン状態(トークン)を再利用します。

### 2. Slack App を作成する

1. https://api.slack.com/apps → **Create New App** → **From scratch**
2. **Socket Mode** を有効化し、`connections:write` スコープの **App-Level Token**(`xapp-...`)を発行してメモする
3. **OAuth & Permissions** で以下の **Bot Token Scopes** を追加:
   - `app_mentions:read`
   - `chat:write`
   - `im:history`
   - `im:read`
   - `im:write`
4. **Event Subscriptions** で以下を Subscribe:
   - `app_mention`
   - `message.im`
5. ワークスペースにインストールし、**Bot User OAuth Token**(`xoxb-...`)をメモする

### 3. 環境変数を設定

```powershell
copy .env.example .env
```

`.env` を開き、`SLACK_BOT_TOKEN` と `SLACK_APP_TOKEN` をそれぞれ貼り付けます。

### 4. 依存パッケージをインストール

```powershell
pip install -r requirements.txt
```

### 5. 起動

```powershell
python app.py
```

Slack でチャンネルに Bot を招待し、`@BotName こんにちは` とメンションするか、Bot に DM を送ると応答します。

## 使い方

- **チャンネル**: `@BotName <質問>` とメンションすると、同じスレッド内で会話が継続します(スレッドごとに Claude のセッションを維持)。
- **DM**: メンション不要で直接質問できます。
- スレッド内で `reset` と送ると、そのスレッドの会話履歴をリセットします。

## 権限範囲を変更したい場合

`permission-settings.json` の `permissions.deny` からツール名を削除すると、そのツールが解禁されます(例: `Read` を外すとファイル読み取りが可能になる)。ただし Slack から誰でもメッセージを送れる環境で Bash/Edit などを解禁すると、ホストマシン上で任意コマンドが実行可能になるため、信頼できる少人数チャンネル限定などの運用にしてください。

## Supabaseプロジェクトのセットアップ

Web/Slack bot共通のデータベースです。まだ作成していない場合は以下の手順で用意してください。

1. https://supabase.com でプロジェクトを新規作成する。
2. **Authentication > Providers** でEmailプロバイダが有効になっていることを確認する(デフォルトで有効)。
3. **Authentication > Email Templates / URL Configuration** で、Site URL・Redirect URLsに開発時は `http://localhost:3000`、本番は実際のURLを追加する(`/auth/callback` にリダイレクトするため)。
4. **SQL Editor** を開き、[supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql) の内容を貼り付けて実行する。テーブル・RLSポリシー・トリガー・RPC関数(`accept_invitation`, `redeem_slack_link`)が作成される。
5. **Project Settings > API** から以下を取得する:
   - `Project URL` → `SUPABASE_URL` (bot側) / `NEXT_PUBLIC_SUPABASE_URL` (Web側)
   - `anon` `public` キー → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Web側のみ)
   - `service_role` キー → `SUPABASE_SERVICE_ROLE_KEY` (bot側・Web側両方。**絶対にブラウザや`NEXT_PUBLIC_`変数として公開しないこと**)

## Webアプリのセットアップ

```powershell
cd web
npm install
copy .env.local.example .env.local
```

`.env.local` を開き、上記で取得したSupabaseの値と `NEXT_PUBLIC_SITE_URL`(開発時は `http://localhost:3000`)を設定してから起動します。

```powershell
npm run dev
```

`http://localhost:3000` を開き、サインアップ→確認メールのリンクをクリック→ログイン、という流れで動作確認できます。ログイン後、プロジェクトの作成・タスクの追加・メンバー招待・(招待されたアカウントでログインして)招待受諾・Slack連携(`/settings/slack`)などを一通り試してください。

## Slack bot側の追加設定(期日アラート・Q&A)

既存の「Slack Appを作成する」手順に加え、以下を設定してください。

1. **Slash Commands** で `/link` コマンドを新規作成する(Request URLはSocket Modeの場合不要)。
2. Bot Token Scopesに `commands` を追加し、ワークスペースへ再インストールする。
3. ルートの `.env` に `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `WEB_APP_URL` / `ALERT_HOUR` を設定する([.env.example](.env.example)参照)。

### 動作確認の手順

- **Slack⇄Supabaseのユーザー紐付け**: Slackで `/link` と入力 → 表示されたコードをWebアプリの `/settings/slack` で入力 → 「連携しました」と表示されればOK。
- **Q&A**: 紐付け後、Botにメンションまたはdmで「参加しているプロジェクトを教えて」などと質問し、実際のデータに基づいた回答が返ることを確認する。
- **期日アラート**: プロジェクト設定画面(`/projects/[id]/settings`)でSlackチャンネルIDを登録し、期日を明日・本日・過去日に設定したタスクを作成した状態でbotプロセスを起動する。`ALERT_HOUR` の時刻になるとチャンネル/担当者DMへ通知が送られる(即時確認したい場合は一時的に `ALERT_HOUR` を現在時刻に近い値にして再起動する)。

### 運用上の注意

- 期日アラートはSupabase Edge Function/pg_cronではなく、bot内の[APScheduler](https://apscheduler.readthedocs.io/)による日次ジョブとして実装されている。**botプロセスが動き続けている間だけ**アラートが送信されるので、常時起動しておく必要がある。
- スケジュールは常に **Asia/Tokyo(日本時間)** で解釈される(サーバーのローカルタイムゾーンには依存しない)。`ALERT_HOUR`は`9`のような時のみの指定にも`15:52`のような時:分の指定にも対応している。
- bot起動時、ターミナルに `期日アラートの次回実行日時は 8月25日 15時52分 です (タイムゾーン: Asia/Tokyo)` のようなログが出る。これが表示されない、または想定と違う日時になっている場合は`ALERT_HOUR`の設定ミスの可能性が高い。バッチが実際に走った際も `期日アラートチェックを開始します` → `...通知対象のタスクはありませんでした` / `...タスク N件を送信します` のログが必ず出るので、実行されたかどうかはログで確認できる。
- Slack botは`SUPABASE_SERVICE_ROLE_KEY`(RLSをバイパスする鍵)でSupabaseに接続する。これはbotがプロジェクト横断で期日をチェックする必要があるため。アクセス制御は[bot_supabase.py](bot_supabase.py)側のコードで「Slackユーザーに紐付くSupabaseユーザーが参加しているproject_idの範囲」に明示的に絞り込むことで行っている(Webアプリはanon key+ユーザーセッションでRLSがそのまま効く)。

## トラブルシューティング

- `claude` コマンドが見つからないと Bot が報告する場合、CLI がインストールされ PATH に登録されているか確認してください(`CLAUDE_BIN` 環境変数でフルパスを指定することも可能)。
- 応答がタイムアウトする場合は `.env` の `CLAUDE_TIMEOUT_SECONDS` を増やしてください。
- Q&Aで「Supabase連携が設定されていないため、この機能は利用できません」と返る場合、ルートの `.env` に `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` が設定されているか確認してください。
- Webアプリでログイン後すぐに `/login` へ戻される場合、Supabaseの **Authentication > URL Configuration** に `http://localhost:3000/auth/callback`(または本番URL)がリダイレクト先として許可されているか確認してください。
- 招待メールが届かない場合、招待先のメールアドレスがすでにSupabaseに登録済みである可能性があります(この場合は仕様上メール送信をスキップします)。招待された側がログインすれば「メンバー」ページに保留中の招待として表示されるか確認してください。
