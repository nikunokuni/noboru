-- ============================================================
-- 既存のプロジェクトに「神社でお祈りしたいこと」（マイページの自由記述）を追加する
-- schema.sql を以前に実行したプロジェクトで、SQL Editor から1回実行する（何度実行しても大丈夫）
-- ============================================================

-- 本人だけが読み書きできる（管理者も読めない）
CREATE TABLE IF NOT EXISTS prayers (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 1000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE prayers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prayers_owner ON prayers;
-- 神社でお祈りしたいこと：本人のみ
CREATE POLICY prayers_owner ON prayers FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
