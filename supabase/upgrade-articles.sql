-- ============================================================
-- 神社詳細の「紹介記事」と、みんなの参拝の「記事」
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- upgrade-admin.sql・upgrade-edit-revert.sql・upgrade-nickname.sql を先に実行しておく（is_admin()・is_edit_banned()・display_name() を使う）。アプリの更新より先に実行する
-- ============================================================

-- 紹介記事：神社を紹介する記事のURL（ブログ・note など）。一人1社につき1件、何人でも載せられる
--   title / image_url / site_name は載せるときにアプリが記事のページ（OGP）から取ってくる。取れなければ NULL（URLのサイト名を出す）
--   すぐ公開。管理者は hidden で外せる（外された記事は本人にだけ見える。本人は直せないが消せる）
CREATE TABLE IF NOT EXISTS shrine_articles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shrine_id   BIGINT NOT NULL REFERENCES shrines(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url         TEXT NOT NULL CHECK (url ~* '^https?://[^[:space:]]+$' AND char_length(url) <= 2000),
  title       TEXT CHECK (title IS NULL OR char_length(title) <= 200),
  image_url   TEXT CHECK (image_url IS NULL OR (image_url ~* '^https://[^[:space:]]+$' AND char_length(image_url) <= 2000)),
  site_name   TEXT CHECK (site_name IS NULL OR char_length(site_name) <= 100),
  hidden      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shrine_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shrine_articles_recent ON shrine_articles(created_at DESC) WHERE NOT hidden;

-- hidden は管理者だけが変えられる（本人が外された記事を戻せないように）
CREATE OR REPLACE FUNCTION guard_shrine_article() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN
    IF TG_OP = 'INSERT' THEN NEW.hidden := FALSE; ELSE NEW.hidden := OLD.hidden; END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := NOW(); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_shrine_article ON shrine_articles;
CREATE TRIGGER trg_guard_shrine_article BEFORE INSERT OR UPDATE ON shrine_articles
  FOR EACH ROW EXECUTE FUNCTION guard_shrine_article();

ALTER TABLE shrine_articles ENABLE ROW LEVEL SECURITY;
-- 他人の記事は user_id を返さない関数から読む。テーブルを直接読めるのは本人と管理者だけ
DROP POLICY IF EXISTS articles_select ON shrine_articles;
DROP POLICY IF EXISTS articles_insert ON shrine_articles;
DROP POLICY IF EXISTS articles_update ON shrine_articles;
DROP POLICY IF EXISTS articles_delete ON shrine_articles;
CREATE POLICY articles_select ON shrine_articles FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY articles_insert ON shrine_articles FOR INSERT WITH CHECK (auth.uid() = user_id AND NOT is_edit_banned());
CREATE POLICY articles_update ON shrine_articles FOR UPDATE
  USING ((auth.uid() = user_id AND NOT hidden) OR is_admin())
  WITH CHECK ((auth.uid() = user_id AND NOT is_edit_banned()) OR is_admin());
CREATE POLICY articles_delete ON shrine_articles FOR DELETE USING (auth.uid() = user_id OR is_admin());

-- 神社の紹介記事（新しい順）。author は表示する名前（NULL なら名前なし）。mine は自分の記事
CREATE OR REPLACE FUNCTION get_shrine_articles(target BIGINT)
RETURNS TABLE (id UUID, url TEXT, title TEXT, image_url TEXT, site_name TEXT, created_at TIMESTAMPTZ, author TEXT, mine BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.url, a.title, a.image_url, a.site_name, a.created_at, display_name(a.user_id), a.user_id = auth.uid()
  FROM shrine_articles a
  WHERE a.shrine_id = target AND NOT a.hidden
  ORDER BY a.created_at DESC
  LIMIT 50;
$$;

-- みんなの参拝の「記事」：紹介記事のある神社（記事を載せた新しい順）
CREATE OR REPLACE FUNCTION get_recent_articles(max_rows INT DEFAULT 30, skip INT DEFAULT 0)
RETURNS TABLE (id UUID, shrine_id BIGINT, shrine_name TEXT, prefecture TEXT, url TEXT, title TEXT, image_url TEXT, site_name TEXT,
               created_at TIMESTAMPTZ, author TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, s.id, s.name, s.prefecture, a.url, a.title, a.image_url, a.site_name, a.created_at, display_name(a.user_id)
  FROM shrine_articles a JOIN shrines s ON s.id = a.shrine_id
  WHERE NOT a.hidden AND s.status = 'active'
  ORDER BY a.created_at DESC, a.id
  LIMIT LEAST(GREATEST(max_rows, 1), 100) OFFSET GREATEST(skip, 0);
$$;

GRANT EXECUTE ON FUNCTION get_shrine_articles(BIGINT), get_recent_articles(INT, INT) TO anon, authenticated;
