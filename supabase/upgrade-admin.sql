-- ============================================================
-- 既存のプロジェクトに「申請の確認（管理者）」を追加する
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- 最後の INSERT のメールアドレスを自分のものに書き換えてから実行すること
-- ============================================================

ALTER TABLE shrine_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION review_shrine_request(request_id UUID, approve BOOLEAN, shrine JSONB DEFAULT '{}')
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req shrine_requests;
  target BIGINT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION '管理者だけが実行できます' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO req FROM shrine_requests WHERE id = request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '申請が見つかりません'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'この申請は処理済みです'; END IF;

  IF approve AND req.kind = 'add' THEN
    INSERT INTO shrines (name, name_kana, prefecture, municipality, address, lat, lng)
    VALUES (
      COALESCE(NULLIF(btrim(shrine->>'name'), ''), req.name),
      NULLIF(btrim(shrine->>'name_kana'), ''),
      shrine->>'prefecture',
      NULLIF(btrim(shrine->>'municipality'), ''),
      NULLIF(btrim(shrine->>'address'), ''),
      COALESCE((shrine->>'lat')::DOUBLE PRECISION, req.lat),
      COALESCE((shrine->>'lng')::DOUBLE PRECISION, req.lng))
    RETURNING id INTO target;
  ELSIF approve AND req.kind = 'hide' THEN
    UPDATE shrines SET status = 'hidden', updated_at = NOW() WHERE id = req.shrine_id;
    target := req.shrine_id;
  END IF;

  UPDATE shrine_requests SET
    status      = CASE WHEN approve THEN 'approved' ELSE 'rejected' END::request_status,
    shrine_id   = COALESCE(target, shrine_id),
    reviewed_at = NOW()
  WHERE id = request_id;
  RETURN target;
END $$;

REVOKE EXECUTE ON FUNCTION review_shrine_request(UUID, BOOLEAN, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION review_shrine_request(UUID, BOOLEAN, JSONB) TO authenticated;

DROP POLICY IF EXISTS requests_read ON shrine_requests;
CREATE POLICY requests_read ON shrine_requests FOR SELECT USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS admins_read_self ON admins;
CREATE POLICY admins_read_self ON admins FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS app_meta_admin_update ON app_meta;
CREATE POLICY app_meta_admin_update ON app_meta FOR UPDATE
  USING (key = 'shrine_index_version' AND is_admin()) WITH CHECK (key = 'shrine_index_version' AND is_admin());

DROP POLICY IF EXISTS public_data_admin_insert ON storage.objects;
CREATE POLICY public_data_admin_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public-data' AND name LIKE 'shrines-index.%' AND public.is_admin());
DROP POLICY IF EXISTS public_data_admin_read ON storage.objects;
CREATE POLICY public_data_admin_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'public-data' AND public.is_admin());

-- 自分を管理者にする（Googleログインに使っているメールアドレスに書き換える）
INSERT INTO admins (user_id)
SELECT id FROM auth.users WHERE email = 'you@example.com'
ON CONFLICT DO NOTHING;
