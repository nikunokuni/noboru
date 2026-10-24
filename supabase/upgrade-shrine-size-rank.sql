-- ============================================================
-- 大きな神社を社格で決める（勅祭社・二十二社・一宮・別表神社・式内社）
-- upgrade-shrine-size.sql のあとに、SQL Editor から1回実行する（何度実行しても大丈夫。社格の決め方を変えたら実行し直す）。アプリの更新は要らない
-- 取り込み直さなくても、入っている社格から大きな神社がすぐに入れ替わる。情報提供で変えた大きさは変えない
-- 境内の広さで大きな神社にしていたものは「ふつうの神社」に戻す（小さな祠の判定を変えたぶんは、取り込み直すと入る）
-- ============================================================

-- 大きな神社にする社格：勅祭社・二十二社・一宮・別表神社・式内社
-- 式内社でも、大きな神社の摂社・末社・所管社（伊勢神宮の摂社など）は小さなお社なので入れない（別宮は入れる）
CREATE OR REPLACE FUNCTION is_major_rank(rank TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(rank ~ '(勅祭|二十二社|一宮|一之宮|一の宮|別表)'
               OR (rank ~ '式内' AND rank !~ '(摂社|末社|所管社)'), FALSE);
$$;

CREATE OR REPLACE FUNCTION import_shrines(rows JSONB) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  INSERT INTO shrines AS s (
    osm_ref, wikidata_id, name, name_kana, prefecture, municipality, locality, address, lat, lng,
    deities, benefits, shrine_rank, founded, annual_festival, honden_style, nearest_station, nearest_station_m,
    nearest_bus_stop, nearest_bus_stop_m, parking, features, features_source, shrine_size
  )
  SELECT r.osm_ref, r.wikidata_id, r.name, r.name_kana, r.prefecture, r.municipality, r.locality, r.address, r.lat, r.lng,
         r.deities, COALESCE(r.benefits, '{}'), r.shrine_rank, r.founded, r.annual_festival, r.honden_style, r.nearest_station, r.nearest_station_m,
         r.nearest_bus_stop, r.nearest_bus_stop_m, COALESCE(r.parking, 'unknown'), r.features, r.features_source,
         CASE WHEN is_major_rank(r.shrine_rank) THEN 'large' ELSE r.shrine_size END
  FROM jsonb_to_recordset(rows) AS r(
    osm_ref TEXT, wikidata_id TEXT, name TEXT, name_kana TEXT, prefecture TEXT, municipality TEXT, locality TEXT,
    address TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, deities TEXT, benefits TEXT[],
    shrine_rank TEXT, founded TEXT, annual_festival TEXT, honden_style TEXT, nearest_station TEXT, nearest_station_m INTEGER, nearest_bus_stop TEXT,
    nearest_bus_stop_m INTEGER, parking parking_status, features TEXT, features_source TEXT, shrine_size TEXT)
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
    -- 大きさ：情報提供された値は残す。社格（入っている値を優先）が当たれば大きな神社、ほかは地図データから
    shrine_size        = CASE WHEN s.shrine_size_by_user THEN s.shrine_size
                              WHEN is_major_rank(COALESCE(s.shrine_rank, EXCLUDED.shrine_rank)) THEN 'large'
                              ELSE COALESCE(EXCLUDED.shrine_size, s.shrine_size) END,
    updated_at         = NOW();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION import_shrines(JSONB) FROM PUBLIC, anon, authenticated;

UPDATE shrines SET
  shrine_size = CASE WHEN is_major_rank(shrine_rank) THEN 'large' ELSE 'medium' END,
  updated_at  = NOW()
WHERE NOT shrine_size_by_user
  AND (is_major_rank(shrine_rank) OR shrine_size = 'large')
  AND shrine_size IS DISTINCT FROM CASE WHEN is_major_rank(shrine_rank) THEN 'large' ELSE 'medium' END;
