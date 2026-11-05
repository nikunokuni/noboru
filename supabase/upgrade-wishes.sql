-- ============================================================
-- 既存のプロジェクトに「行きたい神社」（神社詳細で印を付け、マップで絞り込む）を追加する
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- アプリの更新より先に実行する
-- ============================================================

-- 本人だけが読み書きできる（管理者も読めない）。神社を削除したら一緒に消える
CREATE TABLE IF NOT EXISTS wishes (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shrine_id  BIGINT NOT NULL REFERENCES shrines(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, shrine_id)
);

ALTER TABLE wishes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wishes_owner ON wishes;
-- 行きたい神社：本人のみ
CREATE POLICY wishes_owner ON wishes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
