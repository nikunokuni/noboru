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

### 申請の確認（管理者）

マイページの「申請の確認」から、神社の追加申請・一覧から外す報告を承認・却下できる（管理者にだけ表示）。

- 追加申請の承認: 名前・場所（緯度, 経度）・都道府県を確認して神社を追加する。近くに登録済みの神社があれば重複の注意が出る
- 外す報告の承認: 対象の神社を一覧から外す（`status = 'hidden'`）
- 承認した内容は、画面上部の「神社一覧を更新する」を押すとアプリの検索・マップに入る（`npm run import:shrines -- --index-only` と同じ）

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
