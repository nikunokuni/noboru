-- ============================================================
-- 既存のプロジェクトに「神社詳細の新しい項目」と「写真のタグ」を追加する
--   創建・例祭・拝観時間・見どころ（情報提供できる）、写真ごとのタグ（鳥居・狛犬・本殿・御朱印・案内板・その他）
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- upgrade-edit-revert.sql を先に実行しておくこと
-- ============================================================

ALTER TABLE shrines ADD COLUMN IF NOT EXISTS founded         TEXT;
ALTER TABLE shrines ADD COLUMN IF NOT EXISTS annual_festival TEXT;
ALTER TABLE shrines ADD COLUMN IF NOT EXISTS visiting_hours  TEXT;
ALTER TABLE shrines ADD COLUMN IF NOT EXISTS highlights      TEXT;

ALTER TABLE shrine_edits DROP CONSTRAINT IF EXISTS shrine_edits_field_check;
ALTER TABLE shrine_edits ADD CONSTRAINT shrine_edits_field_check CHECK (field IN (
  'address', 'deities', 'benefits', 'shrine_rank',
  'access_note', 'parking', 'goshuin', 'features', 'name_kana',
  'goshuin_note', 'nearest_station', 'nearest_bus_stop',
  'founded', 'annual_festival', 'visiting_hours', 'highlights'));

-- 写真のタグ。今ある写真は「その他」
ALTER TABLE photos ADD COLUMN IF NOT EXISTS tag TEXT NOT NULL DEFAULT 'other';
ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_tag_check;
ALTER TABLE photos ADD CONSTRAINT photos_tag_check
  CHECK (tag IN ('torii', 'komainu', 'honden', 'goshuin', 'signboard', 'other'));

-- 本人はタグだけ付け直せる（ほかの列は変えられない）
DROP POLICY IF EXISTS photos_update ON photos;
CREATE POLICY photos_update ON photos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE UPDATE ON photos FROM anon, authenticated;
GRANT UPDATE (tag) ON photos TO authenticated;

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
    founded         = CASE WHEN NEW.field = 'founded'         THEN txt ELSE founded END,
    annual_festival = CASE WHEN NEW.field = 'annual_festival' THEN txt ELSE annual_festival END,
    visiting_hours  = CASE WHEN NEW.field = 'visiting_hours'  THEN txt ELSE visiting_hours END,
    highlights      = CASE WHEN NEW.field = 'highlights'      THEN txt ELSE highlights END,
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
    founded = s.founded, annual_festival = s.annual_festival, visiting_hours = s.visiting_hours, highlights = s.highlights,
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
