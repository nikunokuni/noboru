-- ============================================================
-- 管理者画面の「神社一覧を更新する」で、古い一覧ファイル（shrines-index.<版>.json.gz）を消せるようにする
-- （新しい方から2つは残す。取り込みスクリプトは秘密のキーで動くので、この SQL がなくても消せる）
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- upgrade-admin.sql を先に実行しておくこと
-- ============================================================

DROP POLICY IF EXISTS public_data_admin_delete ON storage.objects;
CREATE POLICY public_data_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'public-data' AND name LIKE 'shrines-index.%' AND public.is_admin());
