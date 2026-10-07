-- ============================================================
-- 既存のプロジェクトに「ニックネーム」を追加し、公開記録・情報提供の履歴から user_id を読めないようにする
--   - ニックネームと「名前を出す」（profiles）
--   - 他人の公開記録・写真・情報提供の履歴は、表を直接読めなくして、必要な列だけを返す関数から読む
--   - 新しい写真のパスは <record_id>/<n>.jpg（user_id を含めない）。今ある写真は scripts/move-photo-paths.mjs で移す
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- upgrade-admin.sql・upgrade-edit-revert.sql・upgrade-shrine-details.sql を先に実行しておくこと
-- ============================================================

-- ニックネーム。「名前を出す」にした人だけ、公開記録・情報提供者の一覧に名前が載る
-- 本人と管理者だけが読める。ほかの人には下の読み取り用の関数を通して名前だけを返す
CREATE TABLE IF NOT EXISTS profiles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname   TEXT CHECK (nickname IS NULL OR (
               nickname = btrim(nickname) AND char_length(nickname) BETWEEN 1 AND 20 AND nickname !~ '[[:cntrl:]]')),
  show_name  BOOLEAN NOT NULL DEFAULT FALSE,   -- 「名前を出す」
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 同じニックネーム（大文字・小文字の違いを含む）は1人だけ
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_nickname ON profiles (lower(nickname)) WHERE nickname IS NOT NULL;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 公開情報の読み取り（user_id は返さず、画面に要る列だけを返す）
--   他人の記録・写真・情報提供の履歴は、表を直接読めない（本人と管理者だけ）。この関数を通す
-- ============================================================

-- 表示する名前。「名前を出す」にしてニックネームがある人だけ。ほかは NULL
CREATE OR REPLACE FUNCTION display_name(target UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT nickname FROM profiles WHERE user_id = target AND show_name AND nickname IS NOT NULL;
$$;

-- 神社の公開記録（新しい順）。author は表示する名前（NULL なら名前なし）
CREATE OR REPLACE FUNCTION get_public_records(target BIGINT, max_rows INT DEFAULT 20)
RETURNS TABLE (id UUID, visited_on DATE, emotion_level INT, public_memo TEXT, photos JSONB, author TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.visited_on, r.emotion_level, r.public_memo,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('path', p.path, 'tag', p.tag) ORDER BY p.created_at, p.path)
                   FROM photos p WHERE p.record_id = r.id), '[]'::JSONB),
         display_name(r.user_id)
  FROM records r
  WHERE r.shrine_id = target AND r.is_public
  ORDER BY r.visited_on DESC, r.created_at DESC
  LIMIT LEAST(GREATEST(max_rows, 1), 100);
$$;

-- 神社の写真（公開記録のものだけ・新しい順）
CREATE OR REPLACE FUNCTION get_shrine_photos(target BIGINT, max_rows INT DEFAULT 200)
RETURNS TABLE (path TEXT, tag TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.path, p.tag
  FROM photos p JOIN records r ON r.id = p.record_id
  WHERE r.shrine_id = target AND r.is_public
  ORDER BY p.created_at DESC, p.path
  LIMIT LEAST(GREATEST(max_rows, 1), 500);
$$;

-- 神社の情報提供者（1人1行・最後に提供した順）。元に戻された変更は数えない
-- name が NULL の行は「名前を出していない人」
CREATE OR REPLACE FUNCTION get_shrine_contributors(target BIGINT)
RETURNS TABLE (name TEXT, edit_count INT, last_edited_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT display_name(e.user_id), COUNT(*)::INT, MAX(e.created_at)
  FROM shrine_edits e
  WHERE e.shrine_id = target AND e.reverted_at IS NULL
  GROUP BY e.user_id
  ORDER BY MAX(e.created_at) DESC;
$$;

-- 写真のパスの先頭が「自分の記録のID」か（パスは <record_id>/<n>.jpg。以前は <user_id>/<record_id>/<n>.jpg）
CREATE OR REPLACE FUNCTION is_own_record_folder(object_name TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM records
    WHERE id = CASE WHEN split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN split_part(object_name, '/', 1)::UUID END
      AND user_id = auth.uid());
$$;

-- 公開記録の写真か
CREATE OR REPLACE FUNCTION is_public_photo(object_name TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM photos p JOIN records r ON r.id = p.record_id
                 WHERE p.path = object_name AND r.is_public);
$$;

-- ニックネームを初期化する（管理者）。不適切な名前を消す
CREATE OR REPLACE FUNCTION reset_nickname(target UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION '管理者だけが実行できます' USING ERRCODE = '42501';
  END IF;
  UPDATE profiles SET nickname = NULL, updated_at = NOW() WHERE user_id = target;
END $$;

REVOKE EXECUTE ON FUNCTION display_name(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION get_public_records(BIGINT, INT), get_shrine_photos(BIGINT, INT), get_shrine_contributors(BIGINT),
  is_own_record_folder(TEXT), is_public_photo(TEXT) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION reset_nickname(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION reset_nickname(UUID) TO authenticated;

-- 読み取りの権限を付け直す
DROP POLICY IF EXISTS records_read ON records;
-- 記録：表を読めるのは本人だけ。他人の公開記録は get_public_records() で（user_id を出さない）
CREATE POLICY records_read   ON records FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS photos_read ON photos;
DROP POLICY IF EXISTS photos_insert ON photos;
-- 写真：表を読めるのは本人だけ。他人の公開記録の写真は get_public_records() / get_shrine_photos() で
CREATE POLICY photos_read ON photos FOR SELECT USING (auth.uid() = user_id);
-- 自分の記録にだけ付けられる
CREATE POLICY photos_insert ON photos FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM records r WHERE r.id = record_id AND r.user_id = auth.uid())
);

DROP POLICY IF EXISTS edits_read ON shrine_edits;
-- 情報提供：履歴を読めるのは管理者だけ（神社詳細の提供者の一覧は get_shrine_contributors() で）。ログインユーザーが追加できる（止められたユーザーを除く）
CREATE POLICY edits_read   ON shrine_edits FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS profiles_read ON profiles;
DROP POLICY IF EXISTS profiles_insert ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;
-- ニックネーム：本人と管理者が読める。本人が登録・変更できる（情報提供を止められたユーザーを除く）
CREATE POLICY profiles_read   ON profiles FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id AND NOT is_edit_banned());
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND NOT is_edit_banned());

DROP POLICY IF EXISTS photos_obj_insert ON storage.objects;
DROP POLICY IF EXISTS photos_obj_delete ON storage.objects;
DROP POLICY IF EXISTS photos_obj_read   ON storage.objects;
CREATE POLICY photos_obj_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND ((storage.foldername(name))[1] = auth.uid()::TEXT OR public.is_own_record_folder(name)));

CREATE POLICY photos_obj_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND ((storage.foldername(name))[1] = auth.uid()::TEXT OR public.is_own_record_folder(name)));

-- 本人の写真、または公開記録の写真なら読める
CREATE POLICY photos_obj_read ON storage.objects FOR SELECT
  USING (bucket_id = 'photos' AND (
    (storage.foldername(name))[1] = auth.uid()::TEXT
    OR public.is_own_record_folder(name)
    OR public.is_public_photo(name)
  ));
