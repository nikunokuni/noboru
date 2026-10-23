-- 蛇窪神社（正式名称 天祖神社／品川区二葉4-4-12）の神社詳細を埋める。SQL Editor で実行する（何度実行しても大丈夫）
-- 公式サイト https://hebikubo.jp/ と品川区観光協会などの紹介をもとにまとめた（2026年10月時点）。
-- 名前は取り込みのたびに OSM の名前で上書きされるので変えない。ほかの列は取り込みで上書きされない。
-- 実行後、管理者画面の「神社一覧を更新する」を押すとマップのタグ（ご利益・御朱印）にも入る。
DO $$
DECLARE
  -- 自動で見つからないときは、エラーに出た候補の id をここに入れて実行し直す（例: target BIGINT := 12345;）
  target BIGINT := NULL;
  n INTEGER;
  list TEXT;
BEGIN
  IF target IS NULL THEN
    -- 中延駅・西大井駅のあたり（約1.5km以内）で、名前に「蛇窪」「天祖」「神明」が入る神社を探す。
    -- 「蛇窪」が入るものがあればそちらを優先する
    WITH c AS (
      SELECT id, name, (name LIKE '%蛇窪%') AS hebi,
             round(111000 * sqrt(power(lat - 35.6060, 2) + power((lng - 139.7180) * cos(radians(35.606)), 2))) AS m
      FROM shrines
      WHERE (name LIKE '%蛇窪%' OR name LIKE '%天祖%' OR name LIKE '%神明%')
        AND lat BETWEEN 35.592 AND 35.620 AND lng BETWEEN 139.701 AND 139.735
    ), pick AS (
      SELECT * FROM c WHERE hebi OR NOT EXISTS (SELECT 1 FROM c WHERE hebi)
    )
    SELECT COUNT(*), MIN(id),
           string_agg(format('id=%s %s（約%sm）', id, name, m), '、' ORDER BY m)
      INTO n, target, list FROM pick;
    IF n <> 1 THEN
      IF n = 0 THEN
        SELECT string_agg(format('id=%s %s（約%sm）', id, name, m), '、' ORDER BY m) INTO list FROM (
          SELECT id, name,
                 round(111000 * sqrt(power(lat - 35.6060, 2) + power((lng - 139.7180) * cos(radians(35.606)), 2))) AS m
          FROM shrines
          WHERE lat BETWEEN 35.592 AND 35.620 AND lng BETWEEN 139.701 AND 139.735
          ORDER BY m LIMIT 15) x;
        RAISE EXCEPTION '蛇窪神社が見つかりません。近くの神社: %。どれかが蛇窪神社なら、その id を target に入れて実行し直してください（なければ、まずアプリから神社の追加を申請・承認する）',
          COALESCE(list, 'なし');
      END IF;
      RAISE EXCEPTION '蛇窪神社の候補が % 件あります: %。正しい id を target に入れて実行し直してください', n, list;
    END IF;
  END IF;

  UPDATE shrines SET
    name_kana       = 'へびくぼじんじゃ',
    address         = '東京都品川区二葉4-4-12',
    deities         = '天照大御神、天児屋根命、応神天皇',
    benefits        = ARRAY['金運', '財運', '開運', '商売繁盛', '厄除け', '家内安全'],
    shrine_rank     = '旧村社',
    founded         = '元亨3年（1323年）ごろ（鎌倉時代末期）',
    annual_festival = '毎年9月15日・16日に近い土・日曜（蛇窪祭）',
    honden_style    = '神明造',
    visiting_hours  = '授与所 9時〜17時／御祈祷 9時〜16時30分（予約制。祭事の日は変わることあり）',
    highlights      = '白蛇辨財天社と白蛇清水の銭洗い（白蛇種銭）、撫で白蛇、蛇窪龍神社、法密稲荷社、大正5年（1916年）奉納の狛犬。巳の日・己巳の日は特に賑わう',
    access_note     = '都営浅草線 中延駅から徒歩約5分、東急大井町線 中延駅から徒歩約6分、JR横須賀線 西大井駅から徒歩約8分',
    goshuin         = 'both',
    goshuin_note    = '本殿に向かって左の社務所で9時〜17時。巳の日・己巳の日・一粒万倍日などに限定御朱印や切り絵御朱印あり（混む日は書き置きのみのことも）。オリジナル御朱印帳あり',
    features        = '正式名称は天祖神社。鎌倉時代末期の元亨2年（1322年）、一帯が大干ばつに見舞われた際、村人が龍神社に祈願すると大雨が降り、そのお礼に「神明社」として創建したと伝わる。'
                   || '後に夢枕に白蛇が現れたことから白蛇信仰が広まり、境内に白蛇辨財天社が祀られた。旧社格は村社。令和元年（2019年）に通称の「蛇窪神社」を正式に用いるようになった。',
    features_source = 'editor',
    updated_at      = NOW()
  WHERE id = target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'id = % の神社がありません', target;
  END IF;

  RAISE NOTICE '蛇窪神社（id = %）を更新しました', target;
END $$;
