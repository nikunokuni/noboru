-- 既存のプロジェクトに「みんなの参拝」（全国の公開記録のタイムライン）を追加する
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- upgrade-nickname.sql を先に実行しておく（display_name() を使う）
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_records_public_timeline ON records(visited_on DESC, created_at DESC) WHERE is_public;

-- みんなの参拝：全国の公開記録（参拝日の新しい順）。写真は最初の1枚だけ。author は表示する名前（NULL なら名前なし）
CREATE OR REPLACE FUNCTION get_public_timeline(max_rows INT DEFAULT 30, skip INT DEFAULT 0)
RETURNS TABLE (id UUID, shrine_id BIGINT, shrine_name TEXT, prefecture TEXT, photo TEXT, author TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, s.id, s.name, s.prefecture,
         (SELECT p.path FROM photos p WHERE p.record_id = r.id ORDER BY p.created_at, p.path LIMIT 1),
         display_name(r.user_id)
  FROM records r JOIN shrines s ON s.id = r.shrine_id
  WHERE r.is_public AND s.status = 'active'
  ORDER BY r.visited_on DESC, r.created_at DESC, r.id
  LIMIT LEAST(GREATEST(max_rows, 1), 100) OFFSET GREATEST(skip, 0);
$$;

GRANT EXECUTE ON FUNCTION get_public_timeline(INT, INT) TO anon, authenticated;

-- ご意見・ご要望の画面に「みんなの参拝」を足す（「探す」は以前の分のために残す）
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_screen_check;
ALTER TABLE feedback ADD CONSTRAINT feedback_screen_check
  CHECK (screen IN ('nearby', 'record', 'shrine', 'map', 'search', 'community', 'records', 'profile', 'other'));
