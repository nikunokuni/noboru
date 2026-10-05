-- ============================================================
-- ノボルの表・関数をすべて削除する（schema.sql を最初から入れ直すとき用）
-- 参拝記録・情報提供なども消えます。Supabase の SQL Editor で実行し、続けて schema.sql を実行する
-- ============================================================
DROP POLICY IF EXISTS photos_obj_insert ON storage.objects;
DROP POLICY IF EXISTS photos_obj_delete ON storage.objects;
DROP POLICY IF EXISTS photos_obj_read   ON storage.objects;
DROP POLICY IF EXISTS public_data_admin_insert ON storage.objects;
DROP POLICY IF EXISTS public_data_admin_read   ON storage.objects;

DROP TABLE IF EXISTS photos, record_private_notes, records, shrine_edits, shrine_requests,
  guide_links, app_meta, admins, shrines CASCADE;

DROP FUNCTION IF EXISTS import_shrines(JSONB), refresh_shrine_stats(BIGINT), refresh_shrine_stats(UUID),
  on_record_change(), apply_shrine_edit(), get_app_stats(), get_prefecture_progress(),
  review_shrine_request(UUID, BOOLEAN, JSONB), is_admin() CASCADE;

DROP TYPE IF EXISTS parking_status, goshuin_status, shrine_status, request_status CASCADE;
