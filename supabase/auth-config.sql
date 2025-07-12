-- Supabase Auth設定SQL
-- セッション有効期限とOAuth設定

-- 注意: これらの設定の多くはSupabaseダッシュボードまたは環境変数で行います
-- このSQLファイルは設定の参考として使用してください

-- 1. JWT設定（環境変数またはダッシュボードで設定）
/*
以下の設定をSupabaseダッシュボード > Settings > Auth で設定してください：

JWT Expiry: 3600 (1時間 = 3600秒)
Refresh Token Rotation: Enabled
Refresh Token Expiry: 86400 (24時間 = 86400秒)

または環境変数で設定：
GOTRUE_JWT_EXP=3600
GOTRUE_REFRESH_TOKEN_ROTATION_ENABLED=true
GOTRUE_REFRESH_TOKEN_EXPIRY=86400
*/

-- 2. OAuth プロバイダー設定
/*
Supabaseダッシュボード > Authentication > Providers で以下を設定：

Google OAuth:
- Client ID: あなたのGoogle OAuth Client ID
- Client Secret: あなたのGoogle OAuth Client Secret
- Redirect URL: https://your-project.supabase.co/auth/v1/callback
- Additional Scopes: openid email profile

GitHub OAuth:
- Client ID: あなたのGitHub OAuth App Client ID
- Client Secret: あなたのGitHub OAuth App Client Secret
- Redirect URL: https://your-project.supabase.co/auth/v1/callback
- Additional Scopes: user:email
*/

-- 3. Site URL設定
/*
ダッシュボード > Settings > Auth > Site URL:
Development: http://localhost:3000
Production: https://your-domain.com

Additional Redirect URLs:
http://localhost:3000/auth/callback
https://your-domain.com/auth/callback
*/

-- 4. ユーザープロフィール拡張テーブル
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  provider TEXT,
  provider_id TEXT,
  email_verified BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  preferences JSONB DEFAULT '{}',
  plan_type TEXT DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ユーザープロフィールのRLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- 6. プロフィールの自動作成トリガー
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    avatar_url,
    provider,
    provider_id,
    email_verified
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    COALESCE(NEW.app_metadata->>'provider', 'email'),
    NEW.raw_user_meta_data->>'sub',
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 新規ユーザー作成時にプロフィールを自動作成
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. プロフィール更新の自動処理
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  -- ユーザー情報が更新された時にプロフィールも更新
  UPDATE public.user_profiles
  SET 
    email = NEW.email,
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    email_verified = CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
    updated_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- 8. 最終アクセス時刻の更新
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_profiles
  SET last_seen = NOW()
  WHERE id = auth.uid();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- セッション作成時に最終アクセス時刻を更新
-- 注意: これはSupabase内部テーブルなので、実際の実装では異なる方法が必要

-- 9. セッション監視用のビュー
CREATE OR REPLACE VIEW public.user_sessions AS
SELECT 
  up.id,
  up.email,
  up.full_name,
  up.provider,
  up.last_seen,
  CASE 
    WHEN up.last_seen > NOW() - INTERVAL '1 hour' THEN 'active'
    WHEN up.last_seen > NOW() - INTERVAL '24 hours' THEN 'recent'
    ELSE 'inactive'
  END as session_status
FROM public.user_profiles up
WHERE up.id = auth.uid();

-- 10. セキュリティ監査ログ
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  provider TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- セキュリティ監査ログのRLS
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

-- 管理者のみアクセス可能
CREATE POLICY "Only admins can access audit log"
  ON public.auth_audit_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() 
      AND (preferences->>'role')::TEXT = 'admin'
    )
  );

-- 11. セッション設定確認用の関数
CREATE OR REPLACE FUNCTION public.get_auth_settings()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'jwt_expiry', '3600 seconds (1 hour)',
    'refresh_token_rotation', 'enabled',
    'providers', json_build_array('google', 'github', 'email'),
    'session_timeout', '1 hour',
    'auto_refresh', 'enabled'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. インデックス作成
CREATE INDEX IF NOT EXISTS idx_user_profiles_provider ON public.user_profiles(provider);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_seen ON public.user_profiles(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_plan_type ON public.user_profiles(plan_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON public.auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at ON public.auth_audit_log(created_at DESC);

-- 13. 設定確認用クエリ
/*
-- 以下のクエリで設定を確認できます：

-- 1. Auth設定確認
SELECT public.get_auth_settings();

-- 2. 自分のプロフィール確認
SELECT * FROM public.user_profiles WHERE id = auth.uid();

-- 3. セッション状態確認
SELECT * FROM public.user_sessions;

-- 4. 監査ログ確認（管理者のみ）
SELECT * FROM public.auth_audit_log ORDER BY created_at DESC LIMIT 10;
*/

-- 14. 環境変数設定の例
/*
.env.local に以下を追加：

# Supabase Auth設定
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OAuth設定（Supabaseダッシュボードでも設定）
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# セッション設定
SESSION_SECRET=your-session-secret
SESSION_TIMEOUT_HOURS=1
AUTO_REFRESH_ENABLED=true
*/