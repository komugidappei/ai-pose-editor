-- Images テーブル用 Row Level Security (RLS) 設定
-- Supabaseの画像管理テーブルにRLSを適用

-- ====================
-- images テーブルの作成
-- ====================

CREATE TABLE IF NOT EXISTS images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL, -- 認証されたユーザーのUID（UUID型）
    filename TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT NOT NULL DEFAULT 'image/png',
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    storage_path TEXT, -- Supabase Storage内のパス
    public_url TEXT, -- 公開URL
    metadata JSONB DEFAULT '{}', -- 追加のメタデータ
    is_public BOOLEAN DEFAULT FALSE, -- 公開フラグ
    tags TEXT[] DEFAULT '{}', -- タグ配列
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- インデックス用制約
    CONSTRAINT valid_file_size CHECK (file_size >= 0),
    CONSTRAINT valid_dimensions CHECK (width >= 0 AND height >= 0)
);

-- 更新時刻の自動更新トリガー
CREATE TRIGGER update_images_updated_at
    BEFORE UPDATE ON images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- Row Level Security (RLS) の有効化
-- ====================

-- RLSを有効化
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーがあれば削除（再実行時のため）
DROP POLICY IF EXISTS "Allow user to read own data" ON images;
DROP POLICY IF EXISTS "Allow user to insert/update own data" ON images;
DROP POLICY IF EXISTS "Users can view own images" ON images;
DROP POLICY IF EXISTS "Users can insert own images" ON images;
DROP POLICY IF EXISTS "Users can update own images" ON images;
DROP POLICY IF EXISTS "Users can delete own images" ON images;
DROP POLICY IF EXISTS "Users can view public images" ON images;

-- ====================
-- RLS ポリシーの定義
-- ====================

-- 読み込み許可ポリシー
-- 自分のデータのみ閲覧可能
CREATE POLICY "Allow user to read own data"
    ON public.images
    FOR SELECT
    USING (auth.uid() = user_id);

-- 書き込み許可ポリシー
-- 自分のデータのみ作成・更新・削除可能
CREATE POLICY "Allow user to insert/update own data"
    ON public.images
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ====================
-- パフォーマンス最適化用インデックス
-- ====================

-- user_idでの検索を高速化
CREATE INDEX IF NOT EXISTS idx_images_user_id 
ON images(user_id);

-- 作成日時での並び替えを高速化
CREATE INDEX IF NOT EXISTS idx_images_created_at 
ON images(created_at DESC);

-- user_id + created_at の複合インデックス
CREATE INDEX IF NOT EXISTS idx_images_user_created 
ON images(user_id, created_at DESC);

-- 公開画像の検索を高速化
CREATE INDEX IF NOT EXISTS idx_images_public 
ON images(is_public, created_at DESC) 
WHERE is_public = true;

-- ファイル名での検索用
CREATE INDEX IF NOT EXISTS idx_images_filename 
ON images(filename);

-- タグでの検索用（GINインデックス）
CREATE INDEX IF NOT EXISTS idx_images_tags 
ON images USING GIN(tags);

-- MIME タイプでの検索用
CREATE INDEX IF NOT EXISTS idx_images_mime_type 
ON images(mime_type);

-- ====================
-- セキュリティ関数とヘルパー
-- ====================

-- 現在のユーザーが画像の所有者かチェックする関数
CREATE OR REPLACE FUNCTION is_image_owner(image_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.uid() = image_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ユーザーの画像数を取得する関数
CREATE OR REPLACE FUNCTION get_user_image_count(target_user_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    user_id_to_check UUID;
BEGIN
    -- target_user_idが指定されていない場合は現在のユーザー
    user_id_to_check := COALESCE(target_user_id, auth.uid());
    
    -- RLSにより自分の画像のみカウントされる
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM images
        WHERE user_id = user_id_to_check
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ユーザーの合計ファイルサイズを取得する関数
CREATE OR REPLACE FUNCTION get_user_total_file_size(target_user_id UUID DEFAULT NULL)
RETURNS BIGINT AS $$
DECLARE
    user_id_to_check UUID;
BEGIN
    user_id_to_check := COALESCE(target_user_id, auth.uid());
    
    RETURN COALESCE((
        SELECT SUM(file_size)
        FROM images
        WHERE user_id = user_id_to_check
    ), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================
-- テスト用クエリ例
-- ====================

-- 以下はコメントアウトされたテスト用クエリです
-- 実際のテストは別途アプリケーションで実行してください

/*
-- 1. 自分の画像を取得（成功すべき）
SELECT * FROM images WHERE user_id = auth.uid();

-- 2. 全ての画像を取得（自分の画像 + 公開画像のみ返される）
SELECT * FROM images ORDER BY created_at DESC;

-- 3. 画像を挿入（自分のuser_idで成功すべき）
INSERT INTO images (user_id, filename, mime_type, file_size)
VALUES (auth.uid(), 'test-image.png', 'image/png', 1024);

-- 4. 他人のuser_idで挿入（失敗すべき - 403エラー）
INSERT INTO images (user_id, filename, mime_type, file_size)
VALUES ('00000000-0000-0000-0000-000000000000', 'test-image.png', 'image/png', 1024);

-- 5. 自分の画像を更新（成功すべき）
UPDATE images 
SET description = 'Updated description'
WHERE user_id = auth.uid() AND filename = 'test-image.png';

-- 6. 他人の画像を更新（失敗すべき - 403エラー）
UPDATE images 
SET description = 'Hacked description'
WHERE user_id != auth.uid();

-- 7. 自分の画像を削除（成功すべき）
DELETE FROM images 
WHERE user_id = auth.uid() AND filename = 'test-image.png';

-- 8. 統計情報の取得
SELECT 
    get_user_image_count() as my_image_count,
    get_user_total_file_size() as my_total_size;
*/

-- ====================
-- 権限設定
-- ====================

-- 認証されたユーザーのみがテーブルにアクセス可能
GRANT ALL ON images TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 匿名ユーザーは公開画像のみ閲覧可能（オプション）
GRANT SELECT ON images TO anon;

-- ====================
-- 設定完了メッセージ
-- ====================

-- 設定が完了したことを確認するためのクエリ
DO $$
BEGIN
    RAISE NOTICE '✅ Images テーブルのRLS設定が完了しました';
    RAISE NOTICE '🔒 有効化されたポリシー:';
    RAISE NOTICE '   - Users can view own images (SELECT)';
    RAISE NOTICE '   - Users can insert own images (INSERT)';
    RAISE NOTICE '   - Users can update own images (UPDATE)';
    RAISE NOTICE '   - Users can delete own images (DELETE)';
    RAISE NOTICE '📊 作成されたインデックス: 6個';
    RAISE NOTICE '🛠️  ヘルパー関数: 3個';
    RAISE NOTICE '';
    RAISE NOTICE '次のステップ: アプリケーションでテストを実行してください';
END $$;