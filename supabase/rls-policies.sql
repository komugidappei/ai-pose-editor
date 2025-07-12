-- Row Level Security (RLS) policies for AI Pose Editor
-- This file contains all RLS policies for securing user data

-- ====================
-- generated_images テーブルのRLS設定
-- ====================

-- RLSを有効化
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーがあれば削除（再実行時のため）
DROP POLICY IF EXISTS "Users can view own images" ON generated_images;
DROP POLICY IF EXISTS "Users can insert own images" ON generated_images;
DROP POLICY IF EXISTS "Users can update own images" ON generated_images;
DROP POLICY IF EXISTS "Users can delete own images" ON generated_images;

-- 読み込みポリシー: ユーザーは自分の画像のみ閲覧可能
CREATE POLICY "Users can view own images" ON generated_images
    FOR SELECT
    USING (auth.uid()::text = user_id);

-- 挿入ポリシー: ユーザーは自分のuser_idでのみ画像を作成可能
CREATE POLICY "Users can insert own images" ON generated_images
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- 更新ポリシー: ユーザーは自分の画像のみ更新可能
CREATE POLICY "Users can update own images" ON generated_images
    FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- 削除ポリシー: ユーザーは自分の画像のみ削除可能
CREATE POLICY "Users can delete own images" ON generated_images
    FOR DELETE
    USING (auth.uid()::text = user_id);

-- ====================
-- その他のテーブル用RLS設定（将来の拡張用）
-- ====================

-- user_profiles テーブル（将来追加される可能性）
-- ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view own profile" ON user_profiles
--     FOR SELECT
--     USING (auth.uid()::text = user_id);

-- saved_poses テーブル（将来追加される可能性）
-- ALTER TABLE saved_poses ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view own poses" ON saved_poses
--     FOR SELECT
--     USING (auth.uid()::text = user_id);

-- ====================
-- パフォーマンス最適化用インデックス
-- ====================

-- user_idでのクエリを高速化
CREATE INDEX IF NOT EXISTS idx_generated_images_user_id 
ON generated_images(user_id);

-- created_atでのソートを高速化
CREATE INDEX IF NOT EXISTS idx_generated_images_created_at 
ON generated_images(created_at DESC);

-- user_id + created_at の複合インデックス（ユーザーの画像を日付順で取得）
CREATE INDEX IF NOT EXISTS idx_generated_images_user_created 
ON generated_images(user_id, created_at DESC);

-- ====================
-- セキュリティ関数（ヘルパー）
-- ====================

-- 現在のユーザーIDを取得する関数
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
BEGIN
    RETURN auth.uid()::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ユーザーが特定のリソースにアクセス可能かチェックする関数
CREATE OR REPLACE FUNCTION can_access_resource(resource_user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.uid()::text = resource_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================
-- 使用例とテスト用クエリ
-- ====================

-- テスト用：現在のユーザーの画像を取得
-- SELECT * FROM generated_images WHERE user_id = get_current_user_id();

-- テスト用：画像を挿入（自分のuser_idのみ可能）
-- INSERT INTO generated_images (user_id, prompt, pose_data, ...) 
-- VALUES (get_current_user_id(), 'test prompt', '{}', ...);

-- テスト用：他人の画像にアクセス試行（403エラーになるはず）
-- SELECT * FROM generated_images WHERE user_id = 'other-user-id';