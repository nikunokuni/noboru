-- ============================================================
-- 既存のプロジェクトに「みんなの参拝」の御朱印帳・鳥居帳・狛犬帳を追加する
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- upgrade-nickname.sql を先に実行しておく（display_name() を使う）。アプリの更新より先に実行する
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_photos_tag ON photos(tag, created_at DESC);

-- 御朱印帳など：公開記録の写真のうち、そのタグのもの（参拝日の新しい順）。見ている人自身の写真は除く
CREATE OR REPLACE FUNCTION get_public_photos_by_tag(photo_tag TEXT, max_rows INT DEFAULT 60, skip INT DEFAULT 0)
RETURNS TABLE (path TEXT, shrine_id BIGINT, shrine_name TEXT, visited_on DATE, author TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.path, s.id, s.name, r.visited_on, display_name(r.user_id)
  FROM photos p JOIN records r ON r.id = p.record_id JOIN shrines s ON s.id = r.shrine_id
  WHERE p.tag = photo_tag AND r.is_public AND s.status = 'active'
    AND r.user_id IS DISTINCT FROM auth.uid()
  ORDER BY r.visited_on DESC, p.created_at DESC, p.path
  LIMIT LEAST(GREATEST(max_rows, 1), 100) OFFSET GREATEST(skip, 0);
$$;

GRANT EXECUTE ON FUNCTION get_public_photos_by_tag(TEXT, INT, INT) TO anon, authenticated;
