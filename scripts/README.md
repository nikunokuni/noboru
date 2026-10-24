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

# 駅・バス停は取らずに、市区町村・地名・住所（国土地理院）・駐車場・Wikidata を入れる（例: 東京・神奈川・埼玉）
npm run import:shrines -- --pref 11,13,14 --no-transit --gsi-address

# 神社一覧ファイルだけ作り直す
npm run import:shrines -- --index-only
```

| オプション | 内容 |
|---|---|
| `--dry-run` | DBに入れず `scripts/out/` にJSONと一覧ファイルを書く（件数・サイズの確認用） |
| `--shrines-only` | 神社の名前と位置、市区町村・近くの地名だけを取り込む（駅・バス停・駐車場・Wikipedia を使わない。いちばん軽い）。あとでこれを外して実行し直すと、残りの情報が足される |
| `--no-transit` | 駅・バス停を取らない（データが多く重いため）。DBにすでに入っている駅・バス停は消さない |
| `--gsi-address` | 住所が空の神社に、国土地理院の逆ジオコーダーで「都道府県＋市区町村＋町字」の住所を入れる（町字は「近くの地名」にも使う）。1件ずつ問い合わせるので1000件で数分。結果は `scripts/.cache/` に保存し、やり直しでは使い回す |
| `--skip-wiki` | Wikidata / Wikipedia を使わない（速い） |
| `--no-index` | 最後の一覧ファイル生成をしない（何回かに分けて取り込むとき） |
| `--no-cache` | `scripts/.cache/` に保存した Overpass の結果を使わず取り直す |
| `--endpoint <URL>` | 最初に試す Overpass サーバーを指定する（だめなら標準のサーバーにも切り替える） |

## 何をしているか

1. Overpass API から神社・祠（`amenity=place_of_worship` / `historic=wayside_shrine` かつ `religion=shinto`）、駅、バス停、駐車場、地名、市区町村の境界を取得
   （混雑したサーバーに断られにくいよう種類ごとに分けて問い合わせ、失敗したら別のサーバーに切り替える。取れた分は `scripts/.cache/` に保存され、やり直したときは続きから取る）
2. 別の神社の敷地の中にある社（境内社）を除外
3. 最寄り駅・バス停（直線距離）、駐車場（敷地内なら「専用」、200m以内なら「近くに」）、市区町村と近くの地名（同じ名前の神社を見分ける用）を計算
4. Wikidata からご祭神（表記をそろえる。`src/lib/deities.js`）・読み仮名、Wikipedia から冒頭の要約（特徴）と、記事の神社の表（インフォボックス）の社格・創建・例祭・本殿の様式（ご祭神は Wikidata になければ）を取得
5. `import_shrines()` で DB に反映。**ユーザーが情報提供した項目は上書きしない**
6. 軽い一覧ファイル `shrines-index.<版>.json.gz` を Storage の `public-data` に置き、`app_meta` の版を更新
   （アプリは起動時に版を確認し、変わっていれば裏で取り直す）。古い一覧ファイルは新しい方から2つを残して消す

## 空欄を埋め直す

前に取り込んだ神社でも、もう一度取り込むと**空欄の項目だけ**が埋まります（入っている値・情報提供された値は変えない）。
Overpass の結果は `scripts/.cache/` に残っているので、2回目は速く終わります。前回と同じオプションで実行してください（`--gsi-address` を外すと「近くの地名」が OSM の地名に戻るため）。

```sh
# 例: 東京・神奈川・埼玉
npm run import:shrines -- --pref 11,13,14 --no-transit --gsi-address
```

| 項目 | 自動で埋まるもの |
|---|---|
| 住所・近くの地名 | `--gsi-address` を付けたとき（国土地理院） |
| 最寄り駅・バス停 | `--no-transit` を外したとき（OSM） |
| 駐車場 | OSM に駐車場があるとき |
| ご祭神・よみがな | OSM に Wikidata の番号がある神社 |
| 社格・創建・例祭・本殿の様式・由緒 | OSM に Wikidata / Wikipedia の記事がある神社（創建・例祭・本殿の様式は [`supabase/upgrade-import-details.sql`](../supabase/upgrade-import-details.sql) の実行が必要） |
| 大きさ | 取り込みのたびに判定し直す（下の「神社の大きさ」。[`supabase/upgrade-shrine-size.sql`](../supabase/upgrade-shrine-size.sql) と [`supabase/upgrade-shrine-size-rank.sql`](../supabase/upgrade-shrine-size-rank.sql) の実行が必要）。情報提供された大きさは変えない |
| ご利益・御朱印・拝観時間・見どころ・アクセスの補足 | 自動では埋まらない（情報提供で入れる） |

## 神社の大きさ

3段階に分けます（上から順に当てはめる）。

| 大きさ | 決め方 |
|---|---|
| 大きな神社 | 社格に勅祭・二十二社・一宮・別表が入っている、または式内社（摂社・末社・所管社は除く。別宮は入れる）。DB の `is_major_rank` で決める（前の取り込みや情報提供で入った社格も見る） |
| 小さな祠 | OSM で祠（`historic=wayside_shrine`）として登録されている、名前がない、または形が 30㎡ 未満（祠の建物だけ）で Wikipedia / Wikidata の記事もない |
| ふつうの神社 | それ以外。点だけの神社や、社殿の建物だけが描かれた神社は大きさがわからないので、ここに入れる |

- 情報提供で変えた大きさは取り込み直しても変えない（「不明」にすると、次の取り込みで自動の値に戻る）
- 社格は Wikipedia のインフォボックスから入る。OSM で Wikidata とつながっていない神社も、300m 以内に同じ名前の Wikidata の神社があればつなぐ（下の「Wikidata とのつなぎ」）。それでもつながらない神社は大きな神社にならない（情報提供で社格か大きさを入れる）

## Wikidata とのつなぎ

Wikipedia を取るとき（`--skip-wiki` / `--shrines-only` でないとき）、OSM で Wikidata とつながっていない名前のある神社を、近くにある同じ名前の Wikidata の神社とつなぎます。つながると、社格・ご祭神・創建・由緒などが Wikipedia から入ります。

- Wikidata の神社（全国）は1回の問い合わせで取り、`scripts/.cache/wikidata-shrines.json` に保存して使い回す（`--no-cache` で取り直す）
- 名前は全角・半角、空白・中黒、括弧の補足（「（京都市）」「(Muko Jinja)」）を除いて比べる。距離は 300m 以内
- すでに別の神社がつながっている Wikidata の番号は使わない。同じ番号に複数の神社が当たったら、いちばん近い神社だけにする
- Wikidata に問い合わせられなかったときは、つなぐのを飛ばして取り込みを続ける
- 名前のない神社（「名称不明の社（〇〇）」）が Wikipedia の記事とつながっていれば、記事名を名前にする（「八幡神社 (京都市)」の括弧は除く）
- 小さな祠の目安は `scripts/lib/process.mjs`、大きな神社にする社格は `supabase/schema.sql` の `is_major_rank` で変えられる
- `npm run size-stats` で、保存済みの地図データから材料ごとの件数と、小さな祠・ふつうの神社の件数を数えられる（ネットワーク・DBを使わない）

## 注意

- 出典表示: 地図・アクセス情報は「© OpenStreetMap contributors」（ODbL）、特徴の Wikipedia 由来の文章は CC BY-SA 4.0。アプリの画面に表示しています
- 境内社の除外は、OSM に神社の敷地（面）が登録されている場合だけ効きます。残ったものはアプリの「一覧から外す報告」で拾います
- 住所（`--gsi-address`）は神社の位置から求めた町字までの住所で、番地は入らない。ユーザーが情報提供した住所や OSM の住所があればそちらを優先する
- `--gsi-address` を付けずに取り込み直すと、「近くの地名」は OSM の地名に戻る（住所は残る）
- 県境の近くでは、隣の県の駅の方が近くても同じ県内の駅が選ばれます
