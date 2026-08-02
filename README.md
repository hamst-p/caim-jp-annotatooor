# Translation Audio Manager

英語原稿・日本語訳・ローマ字読み・読み上げ MP3 を、**センテンス / フレーズ単位（1 行 = 1 フレーズ）** で管理する Web アプリです。

| 列 | 内容 |
| --- | --- |
| Original | 英語の原文（編集可・自動保存） |
| Japanese | 日本語訳（編集可・自動保存） |
| Reading | 日本語の読みをアルファベット表記したもの（編集可・自動保存） |
| Audio | MP3 のアップロード / 再生 / 差し替え / 削除 |

---

## ⚠️ 最初に読んでください（セキュリティ）

このアプリは **認証機能を持ちません**。ログイン画面はなく、開いた人が全員フル権限を持ちます。

README の手順どおりに構築すると、次の状態になります。

- `projects` / `translation_rows` テーブルの **RLS（Row Level Security）が無効**
- `translation-audio` バケットが **Public**
- ブラウザは **anon key** だけで Supabase を読み書きする

つまり **URL を知っている人は誰でも、全プロジェクトとすべての音声を閲覧・編集・削除できます。**

- ✅ ローカル開発、社内の閉じた環境、個人利用
- ❌ インターネットへの一般公開

一般公開する場合は必ず [本番公開前に必要なこと](#11-本番公開前に必要なこと) を実施してください。

---

## 1. アプリの概要

- 認証なし。アプリを開くとすぐ管理画面が表示されます
- 翻訳データは **Supabase PostgreSQL**、MP3 は **Supabase Storage** に保存します
- localStorage に保存するのは **最後に選択したプロジェクト ID だけ** です（翻訳データは保存しません）
- プロジェクト単位でフレーズを管理し、切り替えできます
- テキスト 3 列は入力停止から 600ms 後に自動保存（Saved / Saving / Unsaved changes / Save failed）
- 音声は同時に 1 つだけ再生され、再生中の行がハイライトされます
- 1x / 0.75x / 0.5x 再生、シーク、音量調整に対応
- 行の追加 / 複製 / 削除 / 上下移動
- Bulk Import（3 つのテキストエリアに貼り付けて一括登録・プレビュー付き）
- 検索（Original / Japanese / Reading / audio_file_name 横断）とフィルター
- 折りたたみ可能な右サイドバーの進捗サマリー、行番号の下のステータスアイコン
- ライト / ダークモード、デスクトップ中心＋タブレット / スマートフォン対応

## 2. 必要な環境

- Node.js 20 以降（18.18+ でも動作しますが 20 以上を推奨）
- npm
- Supabase アカウント（無料プランで可）

## 3. Supabase プロジェクトの作成

1. <https://supabase.com/dashboard> にログイン
2. **New project** を選択
3. Name / Database Password / Region を入力して作成
4. プロビジョニング完了まで 1〜2 分待つ

## 4. SQL Editor で schema.sql を実行する

1. ダッシュボード左メニューの **SQL Editor** → **New query**
2. リポジトリの [`supabase/schema.sql`](supabase/schema.sql) の内容を貼り付け
3. **Run** を実行

作成されるもの:

- `public.projects` テーブル
- `public.translation_rows` テーブル
- `translation_rows_project_id_idx` / `translation_rows_position_idx` インデックス
- `public.update_updated_at_column()` 関数と両テーブルの `updated_at` 自動更新トリガー
- （任意）`reorder_translation_rows` / `bulk_insert_translation_rows` RPC

すべて `create ... if not exists` などで冪等なので、何度実行しても安全です。

## 5. Storage バケットを作成する

**方法 A: ダッシュボード（推奨）**

1. 左メニューの **Storage** → **New bucket**
2. Name に `translation-audio` を入力
3. **Public bucket** を **ON**
4. 任意で File size limit を `20MB`、Allowed MIME types を `audio/mpeg` に設定
5. **Create bucket**

**方法 B: SQL**

[`supabase/policies.sql`](supabase/policies.sql) の **SECTION A** を SQL Editor で実行すると、バケット作成と RLS 設定がまとめて行われます。

## 6. Public バケットと anon 権限の設定

`storage.objects` は RLS を無効化できないため、**anon ロールにアップロード / 削除を許可するポリシーが必要**です。

SQL Editor で [`supabase/policies.sql`](supabase/policies.sql) の **SECTION A** を実行してください。次の内容が適用されます。

```sql
alter table public.projects disable row level security;
alter table public.translation_rows disable row level security;
-- + translation-audio バケットに対する anon の select / insert / update / delete ポリシー
```

> このセクションは開発用の設定です。実行するとデータベースと音声ファイルが匿名ユーザーへ完全に開放されます。

## 7. 環境変数の設定

`.env.local.example` をコピーします。

```bash
cp .env.local.example .env.local
```

Supabase ダッシュボードの **Project Settings → API** から値を貼り付けます。

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

- 使うのは **anon public** キーだけです
- **`service_role` キーは絶対にここへ書かないでください。** `NEXT_PUBLIC_` が付いた変数はブラウザのバンドルに含まれ、誰でも読み取れます
- 変数が足りない場合、アプリは真っ白にならず設定手順を案内する画面を表示します

## 8. Seed SQL の実行（任意）

デモデータを入れる場合は、SQL Editor で [`supabase/seed.sql`](supabase/seed.sql) を実行します。

- `CAIM1 Translation Project` と 6 件のフレーズが作成されます
- **音声パスは入れていません。** 存在しないファイルを指す行はプレイヤーが壊れて見えるためです。全行に「Upload MP3」ボタンが表示されます
- 再実行すると同名プロジェクトを削除してから作り直します

Seed を実行しなくても、プロジェクトが 0 件ならアプリが起動時に `CAIM1 Translation Project` を自動作成します。

## 9. パッケージのインストールと開発サーバーの起動

```bash
npm install
```

```bash
npm run dev
```

<http://localhost:3000> を開くと、ログイン画面なしで管理画面が表示されます。

ゼロから構築し直す場合に必要なパッケージ:

```bash
npm install @supabase/supabase-js
```

```bash
npm install zod next-themes lucide-react
```

shadcn/ui のセットアップ:

```bash
npx shadcn@latest init
```

```bash
npx shadcn@latest add button input textarea card dialog alert-dialog select dropdown-menu badge tooltip sonner label progress slider separator skeleton scroll-area tabs alert
```

## 10. 音声アップロードのテスト手順

1. 任意の行の Audio 列で **Upload MP3** をクリック、またはファイルをドラッグ＆ドロップ
2. MP3 以外や 20MB 超のファイルはアップロード前に弾かれ、Toast でエラーが出ます
3. アップロード中は進捗バーとキャンセルボタンが表示されます
4. 完了すると 1x / 0.75x / 0.5x / 一時停止 / 停止 / シークバー / 音量 / ファイル名 / サイズ / 長さ が表示されます
5. Supabase ダッシュボードの **Storage → translation-audio** に
   `projects/{projectId}/{rowId}/{uuid}-{ファイル名}.mp3` が保存されていることを確認
6. **Table Editor → translation_rows** で `audio_path` / `audio_file_name` / `audio_size` / `audio_duration` が入っていることを確認
   （`audio_path` には公開 URL ではなく Storage 内のパスだけが保存されます）
7. **Replace Audio** を押すと、新しいファイルのアップロード成功後に古いファイルが削除されます
8. **Delete Audio** は Storage の削除に成功した場合のみ DB を `null` に更新します

## 11. 本番公開前に必要なこと

無認証・RLS 無効・Public バケットのままインターネットへ公開すると、**第三者が全データを編集・削除できます。** 公開前に次を実施してください。

1. `public.projects` に `owner_id uuid references auth.users(id)` を追加する
2. Supabase Auth（`@supabase/ssr` + middleware）でログインを実装する
3. `lib/supabase/client.ts` の `persistSession` を `true` に戻す
4. `translation-audio` バケットを **Private** に変更する
5. `lib/supabase/storage.ts` の `getAudioUrl()` を、同ファイルに実装済みの `createSignedAudioUrl()` に差し替える
   （プレイヤーは URL を props で受け取るだけなので、変更はこの 1 箇所で済みます）
6. [`supabase/policies.sql`](supabase/policies.sql) の **SECTION B** のコメントを外して実行し、RLS を有効化する

データアクセスがすべて `lib/supabase/*.ts` に閉じているため、認証追加時に UI コンポーネントを書き換える必要はほとんどありません。

## 12. Vercel へのデプロイ

1. リポジトリを GitHub などへ push する（`.env.local` は `.gitignore` 済み）
2. <https://vercel.com/new> でリポジトリを Import
3. Framework Preset は **Next.js**（自動検出）
4. **Environment Variables** に以下を追加（Production / Preview / Development すべて）
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **Deploy**

> Vercel の URL は誰でもアクセスできます。認証と RLS を入れていない状態で公開しないでください。暫定的に閉じたい場合は Vercel の **Deployment Protection**（パスワード / SSO）を有効にしてください。

---

## ディレクトリ構成

```txt
app/
  layout.tsx                     ThemeProvider / TooltipProvider / Toaster
  page.tsx                       Server Component（管理画面を描画するだけ）
  globals.css

components/
  theme-provider.tsx
  translation-manager/
    translation-manager.tsx      全体のオーケストレーション
    audio-player-provider.tsx    HTMLAudioElement を 1 つだけ保持する Provider
    project-selector.tsx
    project-dialog.tsx
    translation-table.tsx
    translation-row.tsx
    editable-text-cell.tsx
    audio-uploader.tsx           AudioUploader / DeleteAudioButton
    audio-player.tsx
    bulk-import-dialog.tsx
    summary-sidebar.tsx
    phrase-list-toolbar.tsx
    row-actions.tsx
    save-status.tsx
    connection-status.tsx
    theme-toggle.tsx
    missing-env-notice.tsx
  ui/                            shadcn/ui

hooks/
  use-projects.ts
  use-translation-rows.ts
  use-row-autosave.ts            debounce / 保存状態 / 競合対策
  use-audio-player.ts            Context と行単位のセレクター
  use-audio-upload.ts            進捗・キャンセル・二重送信防止

lib/
  supabase/
    client.ts                    シングルトン + 環境変数チェック + 接続確認
    projects.ts                  getProjects / createProject / updateProject / deleteProject
    translation-rows.ts          取得・追加・更新・削除・複製・並び順更新
    storage.ts                   uploadAudio / replaceAudio / deleteAudio / getAudioUrl
  validators/
    audio.ts                     MP3・20MB の検証（Zod）
    translation-row.ts           行 / プロジェクト / Bulk Import の検証（Zod）
  audio/
    duration.ts                  再生時間の取得と mm:ss 整形
  utils/
    sanitize-file-name.ts
    row-status.ts                ステータス・フィルター・検索・集計（純関数）
  utils.ts                       cn()

types/
  database.ts                    Supabase の Database 型
  project.ts
  translation.ts
  result.ts                      Result<T> / AppError

supabase/
  schema.sql
  policies.sql
  seed.sql
```

## 設計上のポイント

- **データアクセスの分離**: React コンポーネントから Supabase を直接叩きません。すべて `lib/supabase/*.ts` 経由で、各関数は例外を投げず `Result<T>`（`{ ok: true, data }` / `{ ok: false, error }`）を返します
- **保存競合の防止**: 行ごとに世代番号を持ち、古いレスポンスが新しい入力を上書きしないようにしています。保存に失敗しても入力内容は保持され、Retry ボタンが出ます
- **並び順**: 並び替えのたびに position を 0..n-1 へ振り直し、変更のあった行だけを 1 回の upsert でまとめて保存します（同じ position が発生しません）。失敗時は元の順序へ戻します
- **同時再生の防止**: `AudioPlayerProvider` がアプリ全体で `HTMLAudioElement` を 1 つだけ持つため、構造的に 1 つしか再生されません
- **URL 生成の分離**: `getAudioUrl()` は行コンポーネント側で呼び、`AudioPlayer` は URL を props で受け取るだけです
- **アップロード**: 進捗表示とキャンセルのため Storage の REST エンドポイントへ XHR で送信します（`supabase-js` の `upload()` は進捗と AbortSignal に未対応のため）。認証情報は anon key のみで、`XMLHttpRequest` が無い環境では `supabase-js` にフォールバックします
- **トランザクション**: Bulk Import と行の上下移動は 1 リクエストにまとめているため PostgREST 側で 1 トランザクションになります。明示的なトランザクション境界が欲しい場合は `supabase/schema.sql` の `bulk_insert_translation_rows` / `reorder_translation_rows` RPC に差し替えてください
- **`any` 不使用 / TypeScript strict mode**

## スクリプト

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run lint
```
