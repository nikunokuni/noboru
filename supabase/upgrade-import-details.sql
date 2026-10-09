-- ============================================================
-- 神社詳細に「本殿の様式」を追加し、取り込み（npm run import:shrines）で
-- Wikipedia の神社の表（インフォボックス）から創建・例祭・本殿の様式も入れられるようにする
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- upgrade-shrine-details.sql を先に実行しておくこと。アプリの更新より先に実行する
-- 入っている値（情報提供されたものを含む）は上書きしない。空欄だけが埋まる
-- ============================================================

ALTER TABLE shrines ADD COLUMN IF NOT EXISTS honden_style TEXT;   -- 本殿の様式（「流造」など）

ALTER TABLE shrine_edits DROP CONSTRAINT IF EXISTS shrine_edits_field_check;
ALTER TABLE shrine_edits ADD CONSTRAINT shrine_edits_field_check CHECK (field IN (
               'address', 'deities', 'benefits', 'shrine_rank',
               'access_note', 'parking', 'goshuin', 'features', 'name_kana',
               'goshuin_note', 'nearest_station', 'nearest_bus_stop',
               'founded', 'annual_festival', 'visiting_hours', 'highlights', 'honden_style'));

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
    honden_style    = CASE WHEN NEW.field = 'honden_style'    THEN txt ELSE honden_style END,
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
    honden_style = s.honden_style,
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

CREATE OR REPLACE FUNCTION import_shrines(rows JSONB) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  INSERT INTO shrines AS s (
    osm_ref, wikidata_id, name, name_kana, prefecture, municipality, locality, address, lat, lng,
    deities, benefits, shrine_rank, founded, annual_festival, honden_style, nearest_station, nearest_station_m,
    nearest_bus_stop, nearest_bus_stop_m, parking, features, features_source
  )
  SELECT r.osm_ref, r.wikidata_id, r.name, r.name_kana, r.prefecture, r.municipality, r.locality, r.address, r.lat, r.lng,
         r.deities, COALESCE(r.benefits, '{}'), r.shrine_rank, r.founded, r.annual_festival, r.honden_style, r.nearest_station, r.nearest_station_m,
         r.nearest_bus_stop, r.nearest_bus_stop_m, COALESCE(r.parking, 'unknown'), r.features, r.features_source
  FROM jsonb_to_recordset(rows) AS r(
    osm_ref TEXT, wikidata_id TEXT, name TEXT, name_kana TEXT, prefecture TEXT, municipality TEXT, locality TEXT,
    address TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, deities TEXT, benefits TEXT[],
    shrine_rank TEXT, founded TEXT, annual_festival TEXT, honden_style TEXT, nearest_station TEXT, nearest_station_m INTEGER, nearest_bus_stop TEXT,
    nearest_bus_stop_m INTEGER, parking parking_status, features TEXT, features_source TEXT)
  ON CONFLICT (osm_ref) DO UPDATE SET
    wikidata_id        = EXCLUDED.wikidata_id,
    name               = EXCLUDED.name,
    prefecture         = EXCLUDED.prefecture,
    municipality       = EXCLUDED.municipality,
    locality           = EXCLUDED.locality,
    lat                = EXCLUDED.lat,
    lng                = EXCLUDED.lng,
    -- 駅・バス停を取らずに取り込んだとき（--shrines-only / --no-transit）は、入っている値を消さない
    nearest_station    = CASE WHEN s.nearest_station_by_user  OR EXCLUDED.nearest_station  IS NULL THEN s.nearest_station    ELSE EXCLUDED.nearest_station END,
    nearest_station_m  = CASE WHEN s.nearest_station_by_user  OR EXCLUDED.nearest_station  IS NULL THEN s.nearest_station_m  ELSE EXCLUDED.nearest_station_m END,
    nearest_bus_stop   = CASE WHEN s.nearest_bus_stop_by_user OR EXCLUDED.nearest_bus_stop IS NULL THEN s.nearest_bus_stop   ELSE EXCLUDED.nearest_bus_stop END,
    nearest_bus_stop_m = CASE WHEN s.nearest_bus_stop_by_user OR EXCLUDED.nearest_bus_stop IS NULL THEN s.nearest_bus_stop_m ELSE EXCLUDED.nearest_bus_stop_m END,
    name_kana          = COALESCE(s.name_kana,   EXCLUDED.name_kana),
    address            = COALESCE(s.address,     EXCLUDED.address),
    deities            = COALESCE(s.deities,     EXCLUDED.deities),
    shrine_rank        = COALESCE(s.shrine_rank, EXCLUDED.shrine_rank),
    founded            = COALESCE(s.founded,     EXCLUDED.founded),
    annual_festival    = COALESCE(s.annual_festival, EXCLUDED.annual_festival),
    honden_style       = COALESCE(s.honden_style, EXCLUDED.honden_style),
    benefits           = CASE WHEN cardinality(s.benefits) = 0 THEN EXCLUDED.benefits ELSE s.benefits END,
    parking            = CASE WHEN s.parking = 'unknown' THEN EXCLUDED.parking ELSE s.parking END,
    features           = COALESCE(s.features, EXCLUDED.features),
    features_source    = CASE WHEN s.features IS NULL THEN EXCLUDED.features_source ELSE s.features_source END,
    updated_at         = NOW();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION import_shrines(JSONB) FROM PUBLIC, anon, authenticated;
