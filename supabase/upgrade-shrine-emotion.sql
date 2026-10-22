-- ============================================================
-- 既存のプロジェクトに、神社ごとの「感動の平均」と、自分が情報を追加・訂正した神社の数を追加する
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- アプリの更新より先に実行する
-- ============================================================

-- 公開記録の感動の温度の平均（四捨五入）。NULL = 公開記録なし
ALTER TABLE shrines ADD COLUMN IF NOT EXISTS emotion_avg INTEGER;

CREATE OR REPLACE FUNCTION refresh_shrine_stats(target BIGINT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE shrines s SET
    record_count     = agg.cnt,
    visitor_count    = agg.users,
    emotion_avg      = agg.emotion,
    first_visited_on = agg.first_on,
    stats_updated_at = NOW()
  FROM (
    SELECT COUNT(*)::INT AS cnt,
           COUNT(DISTINCT user_id)::INT AS users,
           ROUND(AVG(emotion_level) FILTER (WHERE is_public))::INT AS emotion,  -- 非公開記録の感動は出さない
           MIN(visited_on) AS first_on
    FROM records WHERE shrine_id = target
  ) agg
  WHERE s.id = target;
END $$;

REVOKE EXECUTE ON FUNCTION refresh_shrine_stats(BIGINT) FROM PUBLIC, anon, authenticated;

-- 感動の温度・公開／非公開を変えたときも集計し直す
DROP TRIGGER IF EXISTS trg_records_stats ON records;
CREATE TRIGGER trg_records_stats
AFTER INSERT OR UPDATE OF shrine_id, visited_on, user_id, emotion_level, is_public OR DELETE ON records
FOR EACH ROW EXECUTE FUNCTION on_record_change();

-- 今ある記録から平均を入れる（記録のある神社だけ）
UPDATE shrines s SET emotion_avg = agg.emotion
FROM (
  SELECT shrine_id, ROUND(AVG(emotion_level) FILTER (WHERE is_public))::INT AS emotion
  FROM records GROUP BY shrine_id
) agg
WHERE s.id = agg.shrine_id AND s.emotion_avg IS DISTINCT FROM agg.emotion;

-- 自分が情報を追加・訂正した神社の数（元に戻された変更は数えない）
CREATE OR REPLACE FUNCTION get_my_edited_shrine_count() RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(DISTINCT shrine_id)::INT FROM shrine_edits
  WHERE user_id = auth.uid() AND reverted_at IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION get_my_edited_shrine_count() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_my_edited_shrine_count() TO authenticated;
