-- ============================================================
-- 既存のプロジェクトに「神社情報の追加・訂正」の新しい項目を追加する
--   御朱印の直書き・書き置き（両方も可）と御朱印のメモ、最寄り駅・バス停の情報提供
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- ============================================================

ALTER TYPE goshuin_status ADD VALUE IF NOT EXISTS 'direct_only';
ALTER TYPE goshuin_status ADD VALUE IF NOT EXISTS 'both';

ALTER TABLE shrines ADD COLUMN IF NOT EXISTS goshuin_note TEXT;
ALTER TABLE shrines ADD COLUMN IF NOT EXISTS nearest_station_by_user  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE shrines ADD COLUMN IF NOT EXISTS nearest_bus_stop_by_user BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE shrine_edits DROP CONSTRAINT IF EXISTS shrine_edits_field_check;
ALTER TABLE shrine_edits ADD CONSTRAINT shrine_edits_field_check CHECK (field IN (
  'address', 'deities', 'benefits', 'shrine_rank',
  'access_note', 'parking', 'goshuin', 'features', 'name_kana',
  'goshuin_note', 'nearest_station', 'nearest_bus_stop'));

CREATE OR REPLACE FUNCTION apply_shrine_edit() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  txt TEXT := NULLIF(btrim(NEW.value #>> '{}'), '');   -- 文字列の項目。空なら NULL に戻す
BEGIN
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

CREATE OR REPLACE FUNCTION import_shrines(rows JSONB) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  INSERT INTO shrines AS s (
    osm_ref, wikidata_id, name, name_kana, prefecture, municipality, address, lat, lng,
    deities, benefits, shrine_rank, nearest_station, nearest_station_m,
    nearest_bus_stop, nearest_bus_stop_m, parking, features, features_source
  )
  SELECT r.osm_ref, r.wikidata_id, r.name, r.name_kana, r.prefecture, r.municipality, r.address, r.lat, r.lng,
         r.deities, COALESCE(r.benefits, '{}'), r.shrine_rank, r.nearest_station, r.nearest_station_m,
         r.nearest_bus_stop, r.nearest_bus_stop_m, COALESCE(r.parking, 'unknown'), r.features, r.features_source
  FROM jsonb_to_recordset(rows) AS r(
    osm_ref TEXT, wikidata_id TEXT, name TEXT, name_kana TEXT, prefecture TEXT, municipality TEXT,
    address TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, deities TEXT, benefits TEXT[],
    shrine_rank TEXT, nearest_station TEXT, nearest_station_m INTEGER, nearest_bus_stop TEXT,
    nearest_bus_stop_m INTEGER, parking parking_status, features TEXT, features_source TEXT)
  ON CONFLICT (osm_ref) DO UPDATE SET
    wikidata_id        = EXCLUDED.wikidata_id,
    name               = EXCLUDED.name,
    prefecture         = EXCLUDED.prefecture,
    municipality       = EXCLUDED.municipality,
    lat                = EXCLUDED.lat,
    lng                = EXCLUDED.lng,
    nearest_station    = CASE WHEN s.nearest_station_by_user  THEN s.nearest_station    ELSE EXCLUDED.nearest_station END,
    nearest_station_m  = CASE WHEN s.nearest_station_by_user  THEN s.nearest_station_m  ELSE EXCLUDED.nearest_station_m END,
    nearest_bus_stop   = CASE WHEN s.nearest_bus_stop_by_user THEN s.nearest_bus_stop   ELSE EXCLUDED.nearest_bus_stop END,
    nearest_bus_stop_m = CASE WHEN s.nearest_bus_stop_by_user THEN s.nearest_bus_stop_m ELSE EXCLUDED.nearest_bus_stop_m END,
    name_kana          = COALESCE(s.name_kana,   EXCLUDED.name_kana),
    address            = COALESCE(s.address,     EXCLUDED.address),
    deities            = COALESCE(s.deities,     EXCLUDED.deities),
    shrine_rank        = COALESCE(s.shrine_rank, EXCLUDED.shrine_rank),
    benefits           = CASE WHEN cardinality(s.benefits) = 0 THEN EXCLUDED.benefits ELSE s.benefits END,
    parking            = CASE WHEN s.parking = 'unknown' THEN EXCLUDED.parking ELSE s.parking END,
    features           = COALESCE(s.features, EXCLUDED.features),
    features_source    = CASE WHEN s.features IS NULL THEN EXCLUDED.features_source ELSE s.features_source END,
    updated_at         = NOW();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION import_shrines(JSONB) FROM PUBLIC, anon, authenticated;
