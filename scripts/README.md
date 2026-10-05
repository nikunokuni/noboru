# 神社マスタの取り込み

OpenStreetMap（Overpass API）・Wikidata・Wikipedia から神社の一覧を作り、Supabase に入れます。
**ネットにつながる自分のPCで実行してください。**

## 準備

`.env` に次を書く（`SUPABASE_SERVICE_ROLE_KEY` は Supabase の Project Settings → API にある秘密のキー。絶対に公開しない）

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

## 使い方

都道府県は JIS コードの番号（1 北海道 〜 13 東京都 〜 47 沖縄県）で指定します。

```sh
# まず1県で試す（DBには入れず scripts/out/ に結果を書く）
npm run import:shrines -- --pref 26 --dry-run

# 問題なければDBへ
npm run import:shrines -- --pref 26

# 全国（Overpass への負荷を抑えるため1県ずつ順に取得。数時間かかります）
npm run import:shrines -- --all

# 神社一覧ファイルだけ作り直す
npm run import:shrines -- --index-only
```

| オプション | 内容 |
|---|---|
| `--dry-run` | DBに入れず `scripts/out/` にJSONと一覧ファイルを書く（件数・サイズの確認用） |
| `--shrines-only` | 神社の名前と位置だけを取り込む（駅・バス停・駐車場・Wikipedia を使わない。いちばん軽い）。あとでこれを外して実行し直すと、残りの情報が足される |
| `--skip-wiki` | Wikidata / Wikipedia を使わない（速い） |
| `--no-index` | 最後の一覧ファイル生成をしない（何回かに分けて取り込むとき） |
| `--no-cache` | `scripts/.cache/` に保存した Overpass の結果を使わず取り直す |
| `--print-query` | 神社の問い合わせ文を表示するだけ（下の「Overpass でつまずくとき」用） |
| `--input <file>` | Overpass に問い合わせず、手元の JSON を使う（`--pref` で1県だけ指定） |
| `--endpoint <URL>` | 最初に試す Overpass サーバーを指定する（だめなら標準のサーバーにも切り替える） |

## Overpass でつまずくとき

何度やっても Overpass のエラーで止まる場合は、ブラウザで神社のデータだけ取ってきて取り込めます（名前と位置だけ）。

1. 問い合わせ文を表示する
   ```sh
   npm run import:shrines -- --pref 26 --print-query
   ```
2. https://overpass-turbo.eu/ を開き、表示された文を左側に貼り付けて「実行」
3. 「エクスポート」→「データ」→「生データ（raw OSM data）」で JSON を保存（例: `kyoto.json`）
4. 保存したファイルを使って取り込む
   ```sh
   npm run import:shrines -- --pref 26 --shrines-only --input kyoto.json
   ```

## 何をしているか

1. Overpass API から神社・祠（点と敷地を別々に）（`amenity=place_of_worship` / `historic=wayside_shrine` かつ `religion=shinto`）、駅、バス停、駐車場、地名、市区町村の境界を取得
   （混雑したサーバーに断られにくいよう種類ごとに分けて問い合わせ、失敗したら別のサーバーに切り替える。取れた分は `scripts/.cache/` に保存され、やり直したときは続きから取る）
2. 別の神社の敷地の中にある社（境内社）を除外
3. 最寄り駅・バス停（直線距離）、駐車場（敷地内なら「専用」、200m以内なら「近くに」）を計算
4. Wikidata からご祭神・読み仮名、Wikipedia から冒頭の要約（特徴）を取得
5. `import_shrines()` で DB に反映。**ユーザーが情報提供した項目は上書きしない**
6. 軽い一覧ファイル `shrines-index.<版>.json.gz` を Storage の `public-data` に置き、`app_meta` の版を更新
   （アプリは起動時に版を確認し、変わっていれば裏で取り直す）

## 注意

- 出典表示: 地図・アクセス情報は「© OpenStreetMap contributors」（ODbL）、特徴の Wikipedia 由来の文章は CC BY-SA 4.0。アプリの画面に表示しています
- 境内社の除外は、OSM に神社の敷地（面）が登録されている場合だけ効きます。残ったものはアプリの「一覧から外す報告」で拾います
- 県境の近くでは、隣の県の駅の方が近くても同じ県内の駅が選ばれます
