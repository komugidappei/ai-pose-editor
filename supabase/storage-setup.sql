-- Supabase Storage設定SQL
-- プライベート画像バケット作成とRLSポリシー設定

-- 1. プライベート画像バケットを作成
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'private-images',
  'private-images',
  false,  -- プライベート設定
  10485760,  -- 10MB = 10 * 1024 * 1024
  ARRAY['image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/jpg'];

-- 2. ストレージオブジェクトのRLSポリシーを有効化
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. プライベート画像の表示ポリシー
-- ユーザーは自分のファイルのみ表示可能
CREATE POLICY "Users can view own private images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'private-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. プライベート画像のアップロードポリシー
-- ユーザーは自分のフォルダにのみアップロード可能
CREATE POLICY "Users can upload to own private folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'private-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.role() = 'authenticated'
);

-- 5. プライベート画像の更新ポリシー
-- ユーザーは自分のファイルのみ更新可能
CREATE POLICY "Users can update own private images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'private-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.role() = 'authenticated'
);

-- 6. プライベート画像の削除ポリシー
-- ユーザーは自分のファイルのみ削除可能
CREATE POLICY "Users can delete own private images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'private-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.role() = 'authenticated'
);

-- 7. サービスロール用のポリシー（管理者アクセス）
-- サービスロールは全ファイルにアクセス可能（署名付きURL生成用）
CREATE POLICY "Service role can access all private images"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'private-images' 
  AND auth.jwt() ->> 'role' = 'service_role'
);

-- 8. 画像メタデータテーブル作成（オプション）
CREATE TABLE IF NOT EXISTS public.image_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  file_size INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  prompt TEXT,
  style TEXT,
  generation_params JSONB,
  is_favorite BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, storage_path)
);

-- 9. 画像メタデータのRLSポリシー
ALTER TABLE public.image_metadata ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のメタデータのみアクセス可能
CREATE POLICY "Users can manage own image metadata"
ON public.image_metadata
FOR ALL
USING (auth.uid() = user_id);

-- 10. 画像メタデータのインデックス作成
CREATE INDEX IF NOT EXISTS idx_image_metadata_user_id ON public.image_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_image_metadata_created_at ON public.image_metadata(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_metadata_tags ON public.image_metadata USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_image_metadata_is_favorite ON public.image_metadata(user_id, is_favorite) WHERE is_favorite = true;

-- 11. 画像統計ビュー作成
CREATE OR REPLACE VIEW public.user_image_stats AS
SELECT 
  user_id,
  COUNT(*) as total_images,
  SUM(file_size) as total_size,
  AVG(file_size) as avg_size,
  MAX(created_at) as last_upload,
  COUNT(*) FILTER (WHERE is_favorite = true) as favorite_count
FROM public.image_metadata
GROUP BY user_id;

-- 12. 画像統計ビューのRLSポリシー
ALTER VIEW public.user_image_stats SET (security_invoker = true);

-- 13. updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_image_metadata_updated_at
  BEFORE UPDATE ON public.image_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 14. ストレージクリーンアップ関数（古いファイルの削除）
CREATE OR REPLACE FUNCTION public.cleanup_old_images(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  old_image RECORD;
BEGIN
  -- 指定日数より古い画像を削除
  FOR old_image IN 
    SELECT storage_path, user_id 
    FROM public.image_metadata 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_old
  LOOP
    -- メタデータを削除
    DELETE FROM public.image_metadata 
    WHERE storage_path = old_image.storage_path 
    AND user_id = old_image.user_id;
    
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. ユーザー削除時のクリーンアップ関数
CREATE OR REPLACE FUNCTION public.cleanup_user_images()
RETURNS TRIGGER AS $$
BEGIN
  -- ユーザーの画像メタデータを削除
  DELETE FROM public.image_metadata WHERE user_id = OLD.id;
  
  -- Note: 実際のストレージファイルはSupabase側で自動削除される
  -- RLSポリシーにより、削除されたユーザーのファイルはアクセス不可になる
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ユーザー削除時のトリガー
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_user_images();

-- 16. バケット情報確認用のビュー
CREATE OR REPLACE VIEW public.storage_bucket_info AS
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets
WHERE id = 'private-images';

-- 17. セキュリティ確認用クエリ
/*
-- 以下のクエリでRLSポリシーが正しく動作することを確認できます

-- 1. バケット確認
SELECT * FROM public.storage_bucket_info;

-- 2. ポリシー確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 3. ユーザーの画像統計確認（認証済みユーザーとして実行）
SELECT * FROM public.user_image_stats WHERE user_id = auth.uid();

-- 4. メタデータ確認
SELECT * FROM public.image_metadata WHERE user_id = auth.uid() ORDER BY created_at DESC;
*/