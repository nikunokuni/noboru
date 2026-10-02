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
