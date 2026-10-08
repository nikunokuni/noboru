-- ============================================================
-- 既存のプロジェクトに「地図から申請した神社が承認されたら参拝記録を作る」を追加する
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- アプリを更新する前に実行すること（申請の送信・申請の確認で from_map を使う）
-- ============================================================

-- 「記録する」の地図でピンを立てて申請（現地にいた）
ALTER TABLE shrine_requests ADD COLUMN IF NOT EXISTS from_map BOOLEAN NOT NULL DEFAULT FALSE;

-- 申請を承認・却下する
--   add  を承認: shrine の内容（name, name_kana, prefecture, municipality, address, lat, lng）で shrines に追加
--               地図から申請（from_map）なら、申請した人の参拝記録を作る（参拝日＝申請日、「現地で記録」の印付き、非公開）
--   hide を承認: 対象の神社を status = 'hidden' にする
-- 戻り値は追加・非表示にした神社の id（却下は NULL）
CREATE OR REPLACE FUNCTION review_shrine_request(request_id UUID, approve BOOLEAN, shrine JSONB DEFAULT '{}')
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req shrine_requests;
  target BIGINT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION '管理者だけが実行できます' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO req FROM shrine_requests WHERE id = request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '申請が見つかりません'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'この申請は処理済みです'; END IF;

  IF approve AND req.kind = 'add' THEN
    INSERT INTO shrines (name, name_kana, prefecture, municipality, address, lat, lng)
    VALUES (
      COALESCE(NULLIF(btrim(shrine->>'name'), ''), req.name),
      NULLIF(btrim(shrine->>'name_kana'), ''),
      shrine->>'prefecture',
      NULLIF(btrim(shrine->>'municipality'), ''),
      NULLIF(btrim(shrine->>'address'), ''),
      COALESCE((shrine->>'lat')::DOUBLE PRECISION, req.lat),
      COALESCE((shrine->>'lng')::DOUBLE PRECISION, req.lng))
    RETURNING id INTO target;
    IF req.from_map THEN
      INSERT INTO records (user_id, shrine_id, visited_on, onsite, is_public)
      VALUES (req.user_id, target, (req.created_at AT TIME ZONE 'Asia/Tokyo')::DATE, TRUE, FALSE);
    END IF;
  ELSIF approve AND req.kind = 'hide' THEN
    UPDATE shrines SET status = 'hidden', updated_at = NOW() WHERE id = req.shrine_id;
    target := req.shrine_id;
  END IF;

  UPDATE shrine_requests SET
    status      = CASE WHEN approve THEN 'approved' ELSE 'rejected' END::request_status,
    shrine_id   = COALESCE(target, shrine_id),
    reviewed_at = NOW()
  WHERE id = request_id;
  RETURN target;
END $$;

REVOKE EXECUTE ON FUNCTION review_shrine_request(UUID, BOOLEAN, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION review_shrine_request(UUID, BOOLEAN, JSONB) TO authenticated;
