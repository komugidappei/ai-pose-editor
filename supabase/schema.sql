-- AI Pose Editor Database Schema
-- このファイルには全てのテーブル定義が含まれています

-- ====================
-- generated_images テーブル
-- ====================

CREATE TABLE IF NOT EXISTS generated_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL, -- 認証されたユーザーのUID
    prompt TEXT NOT NULL,
    pose_data JSONB NOT NULL, -- ポーズデータ（JSON形式）
    image_url TEXT, -- 画像ファイルのURL（Supabase Storageなど）
    image_base64 TEXT, -- Base64エンコードされた画像データ
    is_commercial BOOLEAN DEFAULT FALSE,
    resolution TEXT NOT NULL DEFAULT '512x512',
    style TEXT NOT NULL DEFAULT 'リアル',
    background TEXT NOT NULL DEFAULT '透明',
    processing_time INTEGER, -- 処理時間（ミリ秒）
    ai_style_id TEXT, -- 使用されたAIスタイルのID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 更新時刻の自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_generated_images_updated_at
    BEFORE UPDATE ON generated_images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- saved_poses テーブル（将来の拡張用）
-- ====================

CREATE TABLE IF NOT EXISTS saved_poses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    pose_data JSONB NOT NULL,
    thumbnail TEXT, -- Base64サムネイル
    tags TEXT[], -- タグの配列
    is_public BOOLEAN DEFAULT FALSE, -- 他のユーザーに公開するか
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_saved_poses_updated_at
    BEFORE UPDATE ON saved_poses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- user_profiles テーブル（将来の拡張用）
-- ====================

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'premium', 'pro')),
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    usage_limits JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- prompt_templates テーブル（将来の拡張用）
-- ====================

CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    prompt_data JSONB NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_prompt_templates_updated_at
    BEFORE UPDATE ON prompt_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- daily_usage テーブル（1日あたりの使用回数制限用）
-- ====================

CREATE TABLE IF NOT EXISTS daily_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    image_generation_count INTEGER DEFAULT 0,
    pose_extraction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 一意制約（ユーザーごと、日付ごとに1レコード）
    UNIQUE(user_id, date)
);

CREATE TRIGGER update_daily_usage_updated_at
    BEFORE UPDATE ON daily_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- 基本的なインデックス
-- ====================

-- generated_images
CREATE INDEX IF NOT EXISTS idx_generated_images_user_id ON generated_images(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_images_user_created ON generated_images(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_images_commercial ON generated_images(is_commercial);

-- saved_poses
CREATE INDEX IF NOT EXISTS idx_saved_poses_user_id ON saved_poses(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_poses_public ON saved_poses(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_saved_poses_tags ON saved_poses USING GIN(tags);

-- user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription ON user_profiles(subscription_plan);

-- prompt_templates
CREATE INDEX IF NOT EXISTS idx_prompt_templates_user_id ON prompt_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_public ON prompt_templates(is_public) WHERE is_public = true;

-- daily_usage
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_id ON daily_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON daily_usage(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_usage(user_id, date);