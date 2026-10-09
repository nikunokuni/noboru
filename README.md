# ノボル

神社参拝を記録するスマホ向けWebアプリ。仕様は [`docs/spec.md`](docs/spec.md)。

## セットアップ

1. Supabase で新しいプロジェクトを作り、SQL Editor で [`supabase/schema.sql`](supabase/schema.sql) を実行する
   （テーブル・関数・Storage バケット `photos` / `public-data` が作られる）
2. Authentication → Providers で Google ログインを有効にする
3. `.env.example` を `.env` にコピーして値を入れる
4. 依存関係を入れて起動する

```sh
npm install
npm run dev
```

5. 神社マスタを取り込む（[`scripts/README.md`](scripts/README.md)）
6. 参拝の手引き（note 記事）を `guide_links` テーブルに登録する（Supabase の Table Editor から）
7. 自分を管理者にする（申請の確認ができるようになる）。一度アプリにGoogleログインしてから、SQL Editor で実行する

```sql
INSERT INTO admins (user_id) SELECT id FROM auth.users WHERE email = '<ログインに使ったメールアドレス>';
```

すでに以前の `schema.sql` で作ったプロジェクトでは、代わりに [`supabase/upgrade-admin.sql`](supabase/upgrade-admin.sql) の最後のメールアドレスを書き換えて実行する。

### 既存プロジェクトの更新

以前の `schema.sql` で作ったプロジェクトには、追加された機能の SQL を SQL Editor で実行する（どれも何度実行しても大丈夫）。

| ファイル | 内容 |
|---|---|
| [`supabase/upgrade-admin.sql`](supabase/upgrade-admin.sql) | 申請の確認（管理者） |
| [`supabase/upgrade-shrine-info.sql`](supabase/upgrade-shrine-info.sql) | 情報提供の新項目（御朱印の直書き・書き置き・メモ、最寄り駅・バス停） |
| [`supabase/upgrade-edit-revert.sql`](supabase/upgrade-edit-revert.sql) | 情報提供の確認（管理者が元に戻す・止める） |
| [`supabase/upgrade-locality.sql`](supabase/upgrade-locality.sql) | 近くの地名（同じ名前の神社を見分ける）。実行後に取り込みをやり直す（例: `npm run import:shrines -- --pref 11,13,14 --no-transit --gsi-address`） |
| [`supabase/upgrade-shrine-details.sql`](supabase/upgrade-shrine-details.sql) | 神社詳細の新項目（創建・例祭・拝観時間・見どころ）と写真のタグ。`upgrade-edit-revert.sql` を先に実行しておく |
| [`supabase/upgrade-feedback.sql`](supabase/upgrade-feedback.sql) | アプリへのご意見・ご要望 |
| [`supabase/upgrade-nickname.sql`](supabase/upgrade-nickname.sql) | ニックネーム・公開記録と情報提供の履歴から `user_id` を読めなくする。実行後に `npm run move:photos` で今ある写真を移す（下の「写真のパスを移す」） |
| [`supabase/upgrade-prayer.sql`](supabase/upgrade-prayer.sql) | マイページの「神社でお祈りしたいこと」（本人だけが読める自由記述） |
| （SQL なし）マップのタグ | 一覧ファイルに御朱印・駐車場・ご利益・社格を入れた。アプリの更新後、管理者画面の「神社一覧を更新する」（または `npm run import:shrines -- --index-only`）で一覧ファイルを作り直すと、マップのタグで絞り込めるようになる |
| [`supabase/upgrade-timeline.sql`](supabase/upgrade-timeline.sql) | 「みんなの参拝」タブのタイムライン（全国の公開記録）と、ご意見・ご要望の画面「みんなの参拝」。`upgrade-nickname.sql` を先に実行しておく。アプリの更新より先に実行する |
| [`supabase/upgrade-request-visit.sql`](supabase/upgrade-request-visit.sql) | 「記録する」の地図から申請した神社が承認されたら、申請した人の参拝記録（現地で記録）を作る。アプリの更新より先に実行する |
| [`supabase/upgrade-delete-shrine.sql`](supabase/upgrade-delete-shrine.sql) | 管理者が神社詳細から神社を完全に削除する（参拝記録・写真・情報提供ごと）。アプリの更新より先に実行する |
| [`supabase/upgrade-photo-books.sql`](supabase/upgrade-photo-books.sql) | 「みんなの参拝」の御朱印帳・鳥居帳・狛犬帳（みんなの公開写真をタグごとに見る）。`upgrade-nickname.sql` を先に実行しておく。アプリの更新より先に実行する |
| [`supabase/upgrade-import-details.sql`](supabase/upgrade-import-details.sql) | 取り込みで Wikipedia の神社の表から創建・例祭も入れる。`upgrade-shrine-details.sql` を先に実行しておく。実行後に取り込みをやり直すと空欄が埋まる（[`scripts/README.md`](scripts/README.md) の「空欄を埋め直す」） |

「次回へのメモ」はアプリから外した。以前のプロジェクトの `records.next_memo` 列は使われないまま残る（消すならアプリの更新後に `ALTER TABLE records DROP COLUMN next_memo;`）

### 申請の確認（管理者）

マイページの「申請の確認」から、神社の追加申請・一覧から外す報告を承認・却下できる（管理者にだけ表示）。

- 追加申請の承認: 名前・場所（緯度, 経度）・都道府県を確認して神社を追加する。近くに登録済みの神社があれば重複の注意が出る
- 外す報告の承認: 対象の神社を一覧から外す（`status = 'hidden'`）
- 承認した内容は、画面上部の「神社一覧を更新する」を押すとアプリの検索・マップに入る（`npm run import:shrines -- --index-only` と同じ）

### 情報提供の確認（管理者）

ご祭神・住所などの情報提供は承認なしですぐ反映される。マイページの「情報提供の確認」で最近の変更を「変更前 → 変更後」で見て、明らかないたずらだけ戻す（内容の真偽まで確かめる必要はない）。

- 「元に戻す」: その変更の前の値に戻す。同じ項目に後から別の変更があるときは、新しい方から戻す
- 「提供者 #xxxxxx」を押すとその人の変更だけ表示。「すべて元に戻す」「情報提供を止める」（止めた人は情報提供・申請・ご意見を送れない）

### ニックネームの確認（管理者）

マイページの「ニックネームの確認」で、登録された名前を新しい順に見る・検索する。不適切な名前は「初期化」で消す（本人はまた登録できる。繰り返す人は「情報提供の確認」から情報提供を止めると、ニックネームも変えられなくなる）。「情報提供の確認」でも、提供者の番号の横に名前が出て、その人の変更だけ表示したときに初期化できる。

### 写真のパスを移す（1回だけ）

`upgrade-nickname.sql` の前に保存された写真は、パスに `user_id` が入っている（`<user_id>/<record_id>/<n>.jpg`）。`.env` に `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を入れて、次を実行すると `<record_id>/<n>.jpg` に移る（何度実行しても大丈夫）。

```sh
npm run move:photos -- --dry-run   # 移す件数だけ表示
npm run move:photos
```

### ご意見・ご要望の確認（管理者）

マイページの「アプリへのご意見・ご要望」から届いた内容を、マイページの「ご意見・ご要望の確認」で読む（管理者にだけ表示）。どの画面についてかが付いている。読んで対応したら「対応済みにする」。

| context | 表示場所 |
|---|---|
| `general` | マイページ「参拝の手引き」 |
| `etiquette` | 記録画面の下（1件目だけ表示） |
| `goshuin` | 神社詳細の御朱印欄（1件目だけ表示） |

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド（PWA の Service Worker も生成） |
| `npm test` | テスト（取り込み処理・検索） |
| `npm run import:shrines -- --pref 13` | 神社マスタの取り込み |
| `npm run move:photos` | 写真のパスから `user_id` を外す（1回だけ。上の「写真のパスを移す」） |
