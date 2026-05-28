# att — Asana Time Tracker

![att](/img/att.png)

*English: [README.md](README.md)*

**Asanaを「請求時間の唯一の信頼できる情報源 (SSoT)」** として扱い、週次でSFDCやGoogle Spreadsheetにコピペできるサマリを出すCLI。

「自身の作業を記録し、必要に応じてレポートにあげる」というワークフロー向けに設計。**顧客 = Asana Project** を前提に、各作業セッションはProject配下のタスクに紐付く `time_tracking_entry` として保存されます。

Asanaの **Business / Enterprise** プランが必要です（標準Time Tracking機能を使うため）。

## インストール

```bash
git clone <this repo> ~/work/asana-time-tracker
cd ~/work/asana-time-tracker
npm install
npm link        # `att` コマンドをグローバルに通す
att --help
```

## 初期セットアップ

1. <https://app.asana.com/0/my-apps> でPersonal Access Token (PAT) を発行。
2. 以下を実行:

   ```bash
   att init
   ```

   PATの入力（または環境変数 `ASANA_PAT` の利用）を求められ、その後 **顧客プロジェクトごとの短いalias** を対話的に登録します（例: `acme` → "ACME Corp"）。

3. 自分が請求するロール（顧客レポートCSVの **Kong Resource** 列に出る値）を登録します。AsanaのTime Tracking Category として保存されます:

   ```bash
   att roles add fe "Field Engineer"
   att roles add em "Engagement Manager"
   att roles set-default fe
   ```

設定ファイルは `~/.config/att/config.json` （mode 600）に保存されます。

## 日々の時間記録

```bash
# パターンA — 顧客プロジェクトに新規ad-hocタスクを作成して記録
att log 1.5 acme "kickoff meeting"

# パターンB — 既存のAsanaタスクにURL/GID指定で時間を追加
att log 0.5 --task https://app.asana.com/0/1234.../5678... --comment "follow-up"

# パターンC — そのプロジェクトの最近のタスクから対話選択 (fuzzy select)
att log 1 acme:recent

# 日付を遡って記録
att log 2 beta "design review" --date 2026-05-27

# この1件だけデフォルトと違うロールで記録
att log 1 acme:recent --role em
```

`att log` 実行ごとにタスクに `time_tracking_entry` が作成されます。タスクの「Actual time」フィールドが自動的に更新され、Asana標準UIから確認できます。

## エントリの確認・修正

```bash
att list                  # 今日分
att list --week           # 今週分
att list --date 2026-05-27

att edit <entry-gid> --hours 0.75
att rm   <entry-gid> [<entry-gid> ...]   # 複数指定可。削除前にプレビュー＋確認

att recent --customer acme --days 21
```

`entry-gid` は `att list` の出力に表示されます。

## 週次エクスポート（金曜のフロー）

```bash
att summary --week                                  # Markdown — どこにでも貼れる
att summary --last-week --format md
att summary --week --customer acme --format csv     # 顧客別シート貼り付け用（下記参照）
att summary --week --format sfdc                    # SFDC手入力用（Sun→Sat の日別TSV、グリッドに直接貼れる）
```

**Markdown** (`--format md`, デフォルト): 顧客 × 曜日マトリクス（小数時間）、タスク別内訳、「SFDC entries (1h rounded)」セクションを含む。

**CSV** (`--format csv`): 顧客レポートシート貼り付け用のper-entry行:

| Date | Kong Resource | Activity Details | Hours Consumed |
|---|---|---|---|
| 2026/5/27 | Engagement Manager | 定例会準備 | 1 |
| 2026/5/27 | Field Engineer | 定例会 | 1 |

Asanaの各time entryが1行になります。**`--customer <alias>` で必ず絞ってください** — 貼り付け先シートが顧客別になっているため。0hに丸まる行は出力されません。日付は `YYYY/M/D`、時間は `Math.round(min/60)`、Kong Resource はエントリのロールから取得。

**SFDC** (`--format sfdc`): SFDCの Time Entry グリッドに合わせた貼り付け用 TSV — 1プロジェクト1行、列は **Sun→Sat** の7日分、各セルは整数時間。他フォーマットの Mon→Sun ではなく**SFDCグリッドに合わせた日曜起点の週**で集計され、`--last-week` も Sun→Sat ベースで1週前にシフトします。ターミナルでプロジェクト行を選択し、SFDC側で該当プロジェクト行の SUN セルから貼り付けると7日分が一気に入ります。

```
Week ending 2026-05-23 (Sat)

Beta	0	1	0	2	0	1	0
ACME	0	0	0	2	0	0	0
```

**推奨運用（毎週金曜）**:
1. `att summary --week --format sfdc` → SFDCへ。
2. 顧客ごとに `att summary --week --customer <alias> --format csv` → Spreadsheetの該当顧客タブへ。

## 顧客alias管理

```bash
att projects             # alias一覧 + 各プロジェクトのactual_time合計
att projects add         # Asanaプロジェクトを選んで新しいaliasを登録（対話形式）
att projects rm <alias> [<alias> ...]  # alias解除（複数可、Asanaプロジェクト本体は変更しない）
```

`att projects add` はワークスペース内のプロジェクトを対話的に選べるので、AsanaのURLからProject GIDを掘り出す手間が不要です。`att init` でも追加できますが、再実行するとPAT/ワークスペース確認からやり直しになるので、途中追加用途には `add` が便利です。

## ロール管理 (Kong Resource列)

```bash
att roles                              # alias一覧 + どれがデフォルトか表示
att roles add fe "Field Engineer"      # 同名のAsana Time Tracking Categoryがなければ作成
att roles set-default fe               # --role 省略時のデフォルト
att roles rm <alias> [<alias> ...]     # configからalias削除（Asana側のカテゴリは変更しない）
```

ロールはAsana標準の **Time Tracking Category** として保存されるので、Asana UIや同じワークスペースを参照する他のレポートツールでも一貫して扱えます。

## Claude Codeからの利用

`att` はClaude CodeのBashツールから呼び出されることを想定して設計しています。典型的なプロンプト例:

> 「直近のセッション、ACMEの設計レビューに2.5時間使った。記録して」 → Claudeが `att log 2.5 acme "design review"` を実行

> 「今週分のサマリ出して、SFDC形式で」 → Claudeが `att summary --week --format sfdc` を実行

> 「先週のACMEの作業内訳が見たい」 → Claudeが `att summary --last-week` を実行し、内訳セクションを抜粋

### `/att` Skill のインストール（任意）

このリポジトリには [Claude Code Skill](skills/att/SKILL.md) が同梱されています。自然言語の作業説明を `att log` に翻訳する際の精度・安全性（プレビュー→確認、複数件のバッチ記録、曖昧さの検出など）が上がります。1回インストールすればどの作業ディレクトリからでも使えます:

```bash
npm run install-skill     # skills/att/SKILL.md → ~/.claude/skills/att/SKILL.md にsymlink
```

インストール後、Claude Code内で `/att` と打つか、単に作業内容を話しかけてください。例: 「今 1.5h ACME のキックオフやってた、記録して」。既にClaude Codeを起動中だった場合は再起動してください。アンインストールは `rm ~/.claude/skills/att/SKILL.md`。symlinkなので `git pull` でSkillも自動更新されます。

## 開発

```bash
npm test              # vitest
npm run typecheck     # tsc --noEmit
npm run att -- ...    # 開発時のCLI実行（npm linkなしでもOK）
```

### 既知の問題

- 公式 `asana` SDK が古い `superagent` / `formidable` をtransitive depで引いてくるため、npm auditで脆弱性が検出されます。これらはサーバサイドHTTPパース起因の脆弱性で、本ツールが使うread-onlyのPAT認証フローには影響しません。上流追跡: <https://github.com/Asana/node-asana>

## ロードマップ（MVPには意図的に含めず）

- Google Calendarイベント → `att log` への自動取り込み
- Google Sheets API への直接書き込み
- SFDC API への直接書き込み
- MCPサーバ化（Claude Codeとのより深い統合）
