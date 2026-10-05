-- ============================================================
-- 既存のプロジェクトに「情報提供の確認（管理者が元に戻す・止める）」を追加する
--   情報提供は今まで通りすぐ反映し、管理者がいたずらを元に戻したり、その人の情報提供・申請を止めたりできる
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- 先に upgrade-admin.sql を実行しておくこと
-- ============================================================

ALTER TABLE shrine_edits ADD COLUMN IF NOT EXISTS old_value   JSONB;        -- 変更前の値（{列名: 値}）。元に戻すときに使う
ALTER TABLE shrine_edits ADD COLUMN IF NOT EXISTS reverted_at TIMESTAMPTZ;  -- 管理者が元に戻した時刻

CREATE INDEX IF NOT EXISTS idx_shrine_edits_created ON shrine_edits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shrine_edits_user    ON shrine_edits(user_id, created_at DESC);

-- 情報提供・申請を止めたユーザー
CREATE TABLE IF NOT EXISTS banned_editors (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE banned_editors ENABLE ROW LEVEL SECURITY;

-- 項目ごとに、変更で書き換わる shrines の列
CREATE OR REPLACE FUNCTION shrine_edit_columns(field TEXT) RETURNS TEXT[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE field
    WHEN 'features'         THEN ARRAY['features', 'features_source']
    WHEN 'nearest_station'  THEN ARRAY['nearest_station', 'nearest_station_m', 'nearest_station_by_user']
    WHEN 'nearest_bus_stop' THEN ARRAY['nearest_bus_stop', 'nearest_bus_stop_m', 'nearest_bus_stop_by_user']
    ELSE ARRAY[field]
  END;
$$;

-- 情報提供を shrines に反映（最後に提供された内容を採用）。変更前の値を old_value に残す
CREATE OR REPLACE FUNCTION apply_shrine_edit() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  txt TEXT := NULLIF(btrim(NEW.value #>> '{}'), '');   -- 文字列の項目。空なら NULL に戻す
BEGIN
  NEW.reverted_at := NULL;
  SELECT jsonb_object_agg(e.key, e.value) INTO NEW.old_value
  FROM shrines s, jsonb_each(to_jsonb(s)) AS e
  WHERE s.id = NEW.shrine_id AND e.key = ANY(shrine_edit_columns(NEW.field));

  UPDATE shrines SET
    address         = CASE WHEN NEW.field = 'address'      THEN txt ELSE address END,
    name_kana       = CASE WHEN NEW.field = 'name_kana'    THEN txt ELSE name_kana END,
    deities         = CASE WHEN NEW.field = 'deities'      THEN txt ELSE deities END,
    shrine_rank     = CASE WHEN NEW.field = 'shrine_rank'  THEN txt ELSE shrine_rank END,
    access_note     = CASE WHEN NEW.field = 'access_note'  THEN txt ELSE access_note END,
    goshuin_note    = CASE WHEN NEW.field = 'goshuin_note' THEN txt ELSE goshuin_note END,
    features        = CASE WHEN NEW.field = 'features'     THEN txt ELSE features END,
    features_source = CASE WHEN NEW.field = 'features'     THEN 'user' ELSE features_source END,
    benefits        = CASE WHEN NEW.field = 'benefits'
                        THEN ARRAY(SELECT jsonb_array_elements_text(NEW.value)) ELSE benefits END,
    parking         = CASE WHEN NEW.field = 'parking' THEN (NEW.value #>> '{}')::parking_status ELSE parking END,
    goshuin         = CASE WHEN NEW.field = 'goshuin' THEN (NEW.value #>> '{}')::goshuin_status ELSE goshuin END,
    -- 駅・バス停：提供された文字（「〇〇駅 徒歩10分」など）をそのまま表示する。空にしたら次の取り込みで OSM の値に戻る
    nearest_station         = CASE WHEN NEW.field = 'nearest_station' THEN txt ELSE nearest_station END,
    nearest_station_m       = CASE WHEN NEW.field = 'nearest_station' THEN NULL ELSE nearest_station_m END,
    nearest_station_by_user = CASE WHEN NEW.field = 'nearest_station' THEN txt IS NOT NULL ELSE nearest_station_by_user END,
    nearest_bus_stop         = CASE WHEN NEW.field = 'nearest_bus_stop' THEN txt ELSE nearest_bus_stop END,
    nearest_bus_stop_m       = CASE WHEN NEW.field = 'nearest_bus_stop' THEN NULL ELSE nearest_bus_stop_m END,
    nearest_bus_stop_by_user = CASE WHEN NEW.field = 'nearest_bus_stop' THEN txt IS NOT NULL ELSE nearest_bus_stop_by_user END,
    updated_at      = NOW()
  WHERE id = NEW.shrine_id;
  RETURN NEW;
END $$;

-- 変更前の値を残すため、追加の前に反映する
DROP TRIGGER IF EXISTS trg_shrine_edits_apply ON shrine_edits;
CREATE TRIGGER trg_shrine_edits_apply
BEFORE INSERT ON shrine_edits
FOR EACH ROW EXECUTE FUNCTION apply_shrine_edit();

CREATE OR REPLACE FUNCTION is_edit_banned() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM banned_editors WHERE user_id = auth.uid());
$$;

-- 情報提供を1件元に戻す（管理者）
--   同じ神社・同じ項目に後からの変更があるときは戻さない（新しい変更から順に戻す）
CREATE OR REPLACE FUNCTION revert_shrine_edit(edit_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e shrine_edits;
  s shrines;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION '管理者だけが実行できます' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO e FROM shrine_edits WHERE id = edit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '情報提供が見つかりません'; END IF;
  IF e.reverted_at IS NOT NULL THEN RAISE EXCEPTION 'すでに元に戻しています'; END IF;
  IF e.old_value IS NULL THEN RAISE EXCEPTION '変更前の値が残っていないため戻せません（この機能を入れる前の変更です）'; END IF;
  IF EXISTS (SELECT 1 FROM shrine_edits
             WHERE shrine_id = e.shrine_id AND field = e.field AND reverted_at IS NULL AND created_at > e.created_at) THEN
    RAISE EXCEPTION 'この項目は後から変更されています。新しい変更から順に戻してください';
  END IF;

  -- 今の値に変更前の値を重ねたもの
  SELECT * INTO s FROM jsonb_populate_record(NULL::shrines,
    (SELECT to_jsonb(x) FROM shrines x WHERE x.id = e.shrine_id) || e.old_value);

  UPDATE shrines SET
    address = s.address, name_kana = s.name_kana, deities = s.deities, shrine_rank = s.shrine_rank,
    access_note = s.access_note, goshuin_note = s.goshuin_note,
    features = s.features, features_source = s.features_source,
    benefits = s.benefits, parking = s.parking, goshuin = s.goshuin,
    nearest_station = s.nearest_station, nearest_station_m = s.nearest_station_m,
    nearest_station_by_user = s.nearest_station_by_user,
    nearest_bus_stop = s.nearest_bus_stop, nearest_bus_stop_m = s.nearest_bus_stop_m,
    nearest_bus_stop_by_user = s.nearest_bus_stop_by_user,
    updated_at = NOW()
  WHERE id = e.shrine_id;

  UPDATE shrine_edits SET reverted_at = NOW() WHERE id = edit_id;
END $$;

-- あるユーザーの情報提供を新しい順にまとめて元に戻す（管理者）
-- 戻り値: { reverted: 戻した件数, skipped: 後から別の人が変更したなどで戻せなかった件数 }
CREATE OR REPLACE FUNCTION revert_user_edits(target UUID) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  edit RECORD;
  reverted INTEGER := 0;
  skipped  INTEGER := 0;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION '管理者だけが実行できます' USING ERRCODE = '42501';
  END IF;
  FOR edit IN SELECT id FROM shrine_edits WHERE user_id = target AND reverted_at IS NULL ORDER BY created_at DESC LOOP
    BEGIN
      PERFORM revert_shrine_edit(edit.id);
      reverted := reverted + 1;
    EXCEPTION WHEN OTHERS THEN
      skipped := skipped + 1;
    END;
  END LOOP;
  RETURN json_build_object('reverted', reverted, 'skipped', skipped);
END $$;

-- 情報提供・申請を止める／止めるのをやめる（管理者）
CREATE OR REPLACE FUNCTION set_editor_banned(target UUID, banned BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION '管理者だけが実行できます' USING ERRCODE = '42501';
  END IF;
  IF banned THEN
    INSERT INTO banned_editors (user_id) VALUES (target) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM banned_editors WHERE user_id = target;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION revert_shrine_edit(UUID), revert_user_edits(UUID), set_editor_banned(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION revert_shrine_edit(UUID), revert_user_edits(UUID), set_editor_banned(UUID, BOOLEAN) TO authenticated;

-- 止められたユーザーは情報提供・申請ができない
DROP POLICY IF EXISTS edits_insert ON shrine_edits;
CREATE POLICY edits_insert ON shrine_edits FOR INSERT WITH CHECK (auth.uid() = user_id AND NOT is_edit_banned());
DROP POLICY IF EXISTS requests_insert ON shrine_requests;
CREATE POLICY requests_insert ON shrine_requests FOR INSERT WITH CHECK (auth.uid() = user_id AND NOT is_edit_banned());

-- 止めたユーザーの一覧は管理者が読める
DROP POLICY IF EXISTS banned_editors_admin_read ON banned_editors;
CREATE POLICY banned_editors_admin_read ON banned_editors FOR SELECT USING (is_admin());
