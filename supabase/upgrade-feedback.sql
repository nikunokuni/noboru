-- ============================================================
-- 既存のプロジェクトに「アプリへのご意見・ご要望」を追加する
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- upgrade-admin.sql・upgrade-edit-revert.sql を先に実行しておくこと
-- ============================================================

-- アプリへのご意見・ご要望（管理者だけが読める）
CREATE TABLE IF NOT EXISTS feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  screen     TEXT NOT NULL CHECK (screen IN ('nearby', 'record', 'shrine', 'map', 'search', 'records', 'profile', 'other')),  -- どの画面について
  body       TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  done_at    TIMESTAMPTZ,                       -- 管理者が「対応済み」にした時刻
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_insert ON feedback;
DROP POLICY IF EXISTS feedback_admin_read ON feedback;
DROP POLICY IF EXISTS feedback_admin_update ON feedback;
-- ご意見・ご要望：ログインユーザーが送れる（止められたユーザーを除く）。読む・対応済みにするのは管理者だけ
CREATE POLICY feedback_insert ON feedback FOR INSERT WITH CHECK (auth.uid() = user_id AND NOT is_edit_banned());
CREATE POLICY feedback_admin_read   ON feedback FOR SELECT USING (is_admin());
CREATE POLICY feedback_admin_update ON feedback FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
