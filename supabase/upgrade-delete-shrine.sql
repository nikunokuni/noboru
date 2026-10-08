-- ============================================================
-- 既存のプロジェクトに「管理者が神社を削除する」を追加する
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- アプリを更新する前に実行すること（神社詳細の「この神社を削除する」で delete_shrine を使う）
-- ============================================================

-- 神社を完全に削除する（管理者）。その神社の参拝記録（みんなの分）・写真の行・非公開メモ・情報提供・申請も消える
-- 戻り値は消した記録の写真のパス（Storage のファイルはアプリが続けて消す）
CREATE OR REPLACE FUNCTION delete_shrine(target BIGINT) RETURNS TEXT[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  paths TEXT[];
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION '管理者だけが実行できます' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM shrines WHERE id = target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '神社が見つかりません'; END IF;

  SELECT COALESCE(array_agg(p.path), '{}') INTO paths
  FROM photos p JOIN records r ON r.id = p.record_id WHERE r.shrine_id = target;
  DELETE FROM records WHERE shrine_id = target;   -- photos・record_private_notes は ON DELETE CASCADE
  DELETE FROM shrines WHERE id = target;          -- shrine_edits・shrine_requests は ON DELETE CASCADE
  RETURN paths;
END $$;

REVOKE EXECUTE ON FUNCTION delete_shrine(BIGINT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION delete_shrine(BIGINT) TO authenticated;

-- どの記録にも付いていない写真ファイルか（神社を消したあとに残ったファイル）
CREATE OR REPLACE FUNCTION is_orphan_photo(object_name TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM photos WHERE path = object_name);
$$;

GRANT EXECUTE ON FUNCTION is_orphan_photo(TEXT) TO authenticated;

-- 管理者は、どの記録にも付いていない写真ファイルを消せる（Storage の削除には読む権限も要る）
DROP POLICY IF EXISTS photos_obj_admin_orphan_read   ON storage.objects;
DROP POLICY IF EXISTS photos_obj_admin_orphan_delete ON storage.objects;
CREATE POLICY photos_obj_admin_orphan_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'photos' AND public.is_admin() AND public.is_orphan_photo(name));
CREATE POLICY photos_obj_admin_orphan_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND public.is_admin() AND public.is_orphan_photo(name));
