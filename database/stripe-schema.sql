-- Stripe決済連携用データベーススキーマ
-- セキュリティ強化：RLS、監査ログ、制約

-- ユーザープラン管理テーブル
CREATE TABLE user_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name VARCHAR(20) NOT NULL CHECK (plan_name IN ('FREE', 'PREMIUM', 'PRO')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete')),
  
  -- Stripe関連情報
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  
  -- プラン期間
  upgraded_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- 監査情報
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 制約
  UNIQUE(user_id),
  
  -- インデックス
  INDEX idx_user_plans_user_id (user_id),
  INDEX idx_user_plans_stripe_customer (stripe_customer_id),
  INDEX idx_user_plans_stripe_subscription (stripe_subscription_id),
  INDEX idx_user_plans_status (status),
  INDEX idx_user_plans_expires (expires_at)
);

-- Row Level Security (RLS)
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のプラン情報のみ参照可能
CREATE POLICY "Users can view own plan" ON user_plans
  FOR SELECT USING (auth.uid() = user_id);

-- サービスロールのみ更新可能
CREATE POLICY "Service role can manage plans" ON user_plans
  FOR ALL USING (auth.role() = 'service_role');

-- 決済ログテーブル（監査用）
CREATE TABLE payment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- イベント情報
  event_type VARCHAR(50) NOT NULL,
  plan_name VARCHAR(20),
  
  -- 決済情報
  amount INTEGER, -- 円単位
  currency VARCHAR(3) DEFAULT 'jpy',
  
  -- Stripe関連
  stripe_session_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  
  -- メタデータ
  metadata JSONB,
  error_message TEXT,
  notes TEXT,
  
  -- 監査情報
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- インデックス
  INDEX idx_payment_logs_user_id (user_id),
  INDEX idx_payment_logs_event_type (event_type),
  INDEX idx_payment_logs_created_at (created_at),
  INDEX idx_payment_logs_stripe_session (stripe_session_id),
  INDEX idx_payment_logs_stripe_customer (stripe_customer_id)
);

-- Row Level Security (RLS)
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のログのみ参照可能
CREATE POLICY "Users can view own payment logs" ON payment_logs
  FOR SELECT USING (auth.uid() = user_id);

-- サービスロールのみ挿入可能
CREATE POLICY "Service role can insert payment logs" ON payment_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ユーザー使用量テーブル（既存の拡張）
ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS commercial_use_count INTEGER DEFAULT 0;

-- 商用利用カウント用のインデックス
CREATE INDEX IF NOT EXISTS idx_user_usage_commercial ON user_usage(user_id, commercial_use_count);

-- ユーザー画像テーブル（既存の拡張）
ALTER TABLE user_images ADD COLUMN IF NOT EXISTS is_commercial BOOLEAN DEFAULT FALSE;
ALTER TABLE user_images ADD COLUMN IF NOT EXISTS watermark_applied BOOLEAN DEFAULT TRUE;

-- 商用利用・ウォーターマーク用インデックス
CREATE INDEX IF NOT EXISTS idx_user_images_commercial ON user_images(user_id, is_commercial);
CREATE INDEX IF NOT EXISTS idx_user_images_watermark ON user_images(user_id, watermark_applied);

-- プラン制限チェック関数
CREATE OR REPLACE FUNCTION check_plan_limits(
  p_user_id UUID,
  p_action VARCHAR(50)
) RETURNS JSONB AS $$
DECLARE
  v_plan user_plans%ROWTYPE;
  v_usage user_usage%ROWTYPE;
  v_image_count INTEGER;
  v_result JSONB;
BEGIN
  -- ユーザープラン取得
  SELECT * INTO v_plan FROM user_plans WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    -- デフォルトでFreeプラン
    v_plan.plan_name := 'FREE';
  END IF;
  
  -- 今日の使用量取得
  SELECT * INTO v_usage FROM user_usage 
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
  
  IF NOT FOUND THEN
    v_usage.image_generation_count := 0;
    v_usage.commercial_use_count := 0;
  END IF;
  
  -- 総画像数取得
  SELECT COUNT(*) INTO v_image_count FROM user_images 
  WHERE user_id = p_user_id AND is_deleted = FALSE;
  
  -- プラン別制限チェック
  v_result := jsonb_build_object(
    'plan_name', v_plan.plan_name,
    'can_generate', CASE 
      WHEN v_plan.plan_name = 'FREE' THEN v_usage.image_generation_count < 10
      WHEN v_plan.plan_name = 'PREMIUM' THEN v_usage.image_generation_count < 100
      WHEN v_plan.plan_name = 'PRO' THEN TRUE
      ELSE FALSE
    END,
    'can_upload', CASE 
      WHEN v_plan.plan_name = 'FREE' THEN v_image_count < 10
      WHEN v_plan.plan_name = 'PREMIUM' THEN v_image_count < 100
      WHEN v_plan.plan_name = 'PRO' THEN v_image_count < 1000
      ELSE FALSE
    END,
    'can_use_commercially', CASE 
      WHEN v_plan.plan_name IN ('PREMIUM', 'PRO') THEN TRUE
      ELSE FALSE
    END,
    'needs_watermark', CASE 
      WHEN v_plan.plan_name = 'FREE' THEN TRUE
      ELSE FALSE
    END,
    'remaining_generations', CASE 
      WHEN v_plan.plan_name = 'FREE' THEN GREATEST(0, 10 - v_usage.image_generation_count)
      WHEN v_plan.plan_name = 'PREMIUM' THEN GREATEST(0, 100 - v_usage.image_generation_count)
      WHEN v_plan.plan_name = 'PRO' THEN -1
      ELSE 0
    END,
    'remaining_images', CASE 
      WHEN v_plan.plan_name = 'FREE' THEN GREATEST(0, 10 - v_image_count)
      WHEN v_plan.plan_name = 'PREMIUM' THEN GREATEST(0, 100 - v_image_count)
      WHEN v_plan.plan_name = 'PRO' THEN GREATEST(0, 1000 - v_image_count)
      ELSE 0
    END
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- プラン自動ダウングレード関数（期限切れ処理）
CREATE OR REPLACE FUNCTION downgrade_expired_plans() RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- 期限切れのプランをFreeにダウングレード
  UPDATE user_plans 
  SET 
    plan_name = 'FREE',
    status = 'canceled',
    updated_at = NOW()
  WHERE 
    expires_at < NOW() 
    AND status = 'active'
    AND plan_name != 'FREE';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- ログ記録
  INSERT INTO payment_logs (
    user_id, event_type, plan_name, notes, created_at
  )
  SELECT 
    user_id, 'auto_downgrade', 'FREE', 'Expired plan auto-downgraded', NOW()
  FROM user_plans 
  WHERE plan_name = 'FREE' AND updated_at >= NOW() - INTERVAL '1 minute';
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 期限切れプラン自動ダウングレードのスケジュール実行
-- （pg_cronを使用、またはcronジョブで定期実行）
-- SELECT cron.schedule('downgrade-expired-plans', '0 1 * * *', 'SELECT downgrade_expired_plans();');

-- プラン更新時のトリガー
CREATE OR REPLACE FUNCTION update_plan_timestamp() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_plan_timestamp
  BEFORE UPDATE ON user_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_timestamp();

-- 初期データ（必要に応じて）
-- 管理者用のプラン制限確認ビュー
CREATE VIEW plan_usage_summary AS
SELECT 
  up.user_id,
  up.plan_name,
  up.status,
  up.expires_at,
  uu.image_generation_count,
  uu.commercial_use_count,
  COUNT(ui.id) as total_images,
  up.created_at as plan_created_at
FROM user_plans up
LEFT JOIN user_usage uu ON up.user_id = uu.user_id AND uu.date = CURRENT_DATE
LEFT JOIN user_images ui ON up.user_id = ui.user_id AND ui.is_deleted = FALSE
GROUP BY up.user_id, up.plan_name, up.status, up.expires_at, 
         uu.image_generation_count, uu.commercial_use_count, up.created_at;

-- セキュリティ設定
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON user_plans TO authenticated;
GRANT SELECT ON payment_logs TO authenticated;
GRANT SELECT ON plan_usage_summary TO authenticated;
GRANT EXECUTE ON FUNCTION check_plan_limits(UUID, VARCHAR) TO authenticated;