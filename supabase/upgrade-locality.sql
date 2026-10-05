-- ============================================================
-- 既存のプロジェクトに「近くの地名」（同じ名前の神社を見分ける用）を追加する
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- 実行後に取り込みをやり直すと地名が入る（npm run import:shrines -- --all --shrines-only でも入る）
-- ============================================================

ALTER TABLE shrines ADD COLUMN IF NOT EXISTS locality TEXT;   -- 近くの地名（町・字など）。OSM から取り込み時に計算

CREATE OR REPLACE FUNCTION import_shrines(rows JSONB) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  INSERT INTO shrines AS s (
    osm_ref, wikidata_id, name, name_kana, prefecture, municipality, locality, address, lat, lng,
    deities, benefits, shrine_rank, nearest_station, nearest_station_m,
    nearest_bus_stop, nearest_bus_stop_m, parking, features, features_source
  )
  SELECT r.osm_ref, r.wikidata_id, r.name, r.name_kana, r.prefecture, r.municipality, r.locality, r.address, r.lat, r.lng,
         r.deities, COALESCE(r.benefits, '{}'), r.shrine_rank, r.nearest_station, r.nearest_station_m,
         r.nearest_bus_stop, r.nearest_bus_stop_m, COALESCE(r.parking, 'unknown'), r.features, r.features_source
  FROM jsonb_to_recordset(rows) AS r(
    osm_ref TEXT, wikidata_id TEXT, name TEXT, name_kana TEXT, prefecture TEXT, municipality TEXT, locality TEXT,
    address TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, deities TEXT, benefits TEXT[],
    shrine_rank TEXT, nearest_station TEXT, nearest_station_m INTEGER, nearest_bus_stop TEXT,
    nearest_bus_stop_m INTEGER, parking parking_status, features TEXT, features_source TEXT)
  ON CONFLICT (osm_ref) DO UPDATE SET
    wikidata_id        = EXCLUDED.wikidata_id,
    name               = EXCLUDED.name,
    prefecture         = EXCLUDED.prefecture,
    municipality       = EXCLUDED.municipality,
    locality           = EXCLUDED.locality,
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
