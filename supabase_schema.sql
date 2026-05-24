-- ノボル Supabase テーブル設計
-- Supabaseの「SQL Editor」に貼り付けて「Run」を押してください

-- 1. 神社テーブル
CREATE TABLE shrines (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  location   TEXT,
  tags       TEXT[] DEFAULT '{}',
  deity      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 記録テーブル
CREATE TABLE records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shrine_id    UUID REFERENCES shrines(id) ON DELETE SET NULL,
  shrine_name  TEXT NOT NULL,
  emotion_level INTEGER CHECK (emotion_level >= 0 AND emotion_level <= 100) DEFAULT 50,
  public_memo  TEXT DEFAULT '',
  private_memo TEXT DEFAULT '',
  next_memo    TEXT DEFAULT '',
  is_public    BOOLEAN DEFAULT TRUE,
  visited_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 写真テーブル
CREATE TABLE photos (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID REFERENCES records(id) ON DELETE CASCADE NOT NULL,
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url       TEXT NOT NULL,
  path      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE shrines ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shrines_read"   ON shrines FOR SELECT USING (TRUE);
CREATE POLICY "shrines_insert" ON shrines FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "shrines_update" ON shrines FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "records_read"   ON records FOR SELECT USING (is_public = TRUE OR auth.uid() = user_id);
CREATE POLICY "records_insert" ON records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "records_update" ON records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "records_delete" ON records FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "photos_read"   ON photos FOR SELECT USING (
  EXISTS (SELECT 1 FROM records r WHERE r.id = record_id AND (r.is_public = TRUE OR r.user_id = auth.uid()))
);
CREATE POLICY "photos_insert" ON photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "photos_delete" ON photos FOR DELETE USING (auth.uid() = user_id);

-- インデックス
CREATE INDEX idx_records_user_id   ON records(user_id);
CREATE INDEX idx_records_shrine_id ON records(shrine_id);
CREATE INDEX idx_records_visited   ON records(visited_at DESC);
CREATE INDEX idx_photos_record_id  ON photos(record_id);
CREATE INDEX idx_shrines_name      ON shrines(name);

-- ==============================
-- Storage バケット設定（SQLではなくUIで操作）
-- ==============================
-- Supabase → Storage → New bucket
--   Bucket name : photos
--   Public bucket: ON（チェックを入れる）
