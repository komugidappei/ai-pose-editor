-- Google reCAPTCHA v2 統計・ログ管理スキーマ
-- ゲストユーザー保護とスパム対策の分析用

-- reCAPTCHA検証ログテーブル
CREATE TABLE recaptcha_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- 検証結果
  success BOOLEAN NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('guest', 'authenticated')),
  action VARCHAR(50) NOT NULL, -- 'image_generation', 'file_upload', etc.
  
  -- Google reCAPTCHA応答
  hostname VARCHAR(255),
  challenge_ts TIMESTAMP WITH TIME ZONE,
  error_codes TEXT[],
  
  -- リクエスト情報
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  
  -- 統計・分析用
  response_time_ms INTEGER, -- reCAPTCHA API応答時間
  retry_count INTEGER DEFAULT 0, -- 再試行回数
  
  -- 監査情報
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- インデックス
  INDEX idx_recaptcha_logs_success (success),
  INDEX idx_recaptcha_logs_user_type (user_type),
  INDEX idx_recaptcha_logs_action (action),
  INDEX idx_recaptcha_logs_created_at (created_at),
  INDEX idx_recaptcha_logs_ip (ip_address),
  INDEX idx_recaptcha_logs_hostname (hostname)
);

-- Row Level Security (RLS)
ALTER TABLE recaptcha_logs ENABLE ROW LEVEL SECURITY;

-- 管理者のみアクセス可能
CREATE POLICY "Admin only access to recaptcha logs" ON recaptcha_logs
  FOR ALL USING (auth.role() = 'service_role');

-- reCAPTCHA統計サマリービュー
CREATE VIEW recaptcha_stats AS
SELECT 
  DATE(created_at) as date,
  user_type,
  action,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE success = true) as successful_attempts,
  COUNT(*) FILTER (WHERE success = false) as failed_attempts,
  ROUND(
    (COUNT(*) FILTER (WHERE success = true) * 100.0) / COUNT(*), 2
  ) as success_rate_percent,
  AVG(response_time_ms) as avg_response_time_ms,
  COUNT(DISTINCT ip_address) as unique_ips
FROM recaptcha_logs
GROUP BY DATE(created_at), user_type, action
ORDER BY date DESC, user_type, action;

-- 疑わしいアクティビティ検出ビュー
CREATE VIEW suspicious_recaptcha_activity AS
SELECT 
  ip_address,
  DATE(created_at) as date,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE success = false) as failed_attempts,
  ROUND(
    (COUNT(*) FILTER (WHERE success = false) * 100.0) / COUNT(*), 2
  ) as failure_rate_percent,
  MAX(created_at) as last_attempt,
  ARRAY_AGG(DISTINCT user_agent) as user_agents
FROM recaptcha_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY ip_address, DATE(created_at)
HAVING 
  COUNT(*) > 20 OR -- 1日20回以上の試行
  (COUNT(*) FILTER (WHERE success = false) * 100.0) / COUNT(*) > 50 -- 失敗率50%以上
ORDER BY failure_rate_percent DESC, total_attempts DESC;

-- reCAPTCHA設定テーブル（動的設定用）
CREATE TABLE recaptcha_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  INDEX idx_recaptcha_config_key (key),
  INDEX idx_recaptcha_config_active (is_active)
);

-- Row Level Security (RLS)
ALTER TABLE recaptcha_config ENABLE ROW LEVEL SECURITY;

-- 管理者のみ編集可能、認証済みユーザーは読み取り可能
CREATE POLICY "Admin can manage recaptcha config" ON recaptcha_config
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read recaptcha config" ON recaptcha_config
  FOR SELECT USING (auth.role() = 'authenticated');

-- デフォルト設定の挿入
INSERT INTO recaptcha_config (key, value, description) VALUES
('require_for_image_generation', 'true', 'ゲストユーザーの画像生成時にreCAPTCHA必須'),
('require_for_file_upload', 'true', 'ゲストユーザーのファイルアップロード時にreCAPTCHA必須'),
('require_for_comments', 'false', 'コメント投稿時にreCAPTCHA必須'),
('max_daily_attempts_per_ip', '100', 'IP別1日最大reCAPTCHA試行回数'),
('block_high_failure_ips', 'true', '高失敗率IPの自動ブロック'),
('failure_rate_threshold', '70', '自動ブロックする失敗率閾値（%）'),
('min_attempts_for_analysis', '10', '分析対象とする最小試行回数');

-- IPブロックリストテーブル
CREATE TABLE blocked_ips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET NOT NULL UNIQUE,
  reason VARCHAR(255) NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blocked_until TIMESTAMP WITH TIME ZONE, -- NULL = 永続ブロック
  is_active BOOLEAN DEFAULT true,
  
  -- 統計情報
  total_attempts INTEGER DEFAULT 0,
  failed_attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMP WITH TIME ZONE,
  
  -- 管理情報
  created_by VARCHAR(255) DEFAULT 'system',
  notes TEXT,
  
  INDEX idx_blocked_ips_ip (ip_address),
  INDEX idx_blocked_ips_active (is_active),
  INDEX idx_blocked_ips_blocked_until (blocked_until)
);

-- Row Level Security (RLS)
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- 管理者のみアクセス可能
CREATE POLICY "Admin only access to blocked ips" ON blocked_ips
  FOR ALL USING (auth.role() = 'service_role');

-- IP自動ブロック関数
CREATE OR REPLACE FUNCTION auto_block_suspicious_ips() RETURNS INTEGER AS $$
DECLARE
  blocked_count INTEGER := 0;
  suspicious_ip RECORD;
  threshold INTEGER;
  min_attempts INTEGER;
BEGIN
  -- 設定値を取得
  SELECT value::INTEGER INTO threshold 
  FROM recaptcha_config 
  WHERE key = 'failure_rate_threshold' AND is_active = true;
  
  SELECT value::INTEGER INTO min_attempts 
  FROM recaptcha_config 
  WHERE key = 'min_attempts_for_analysis' AND is_active = true;
  
  -- デフォルト値設定
  threshold := COALESCE(threshold, 70);
  min_attempts := COALESCE(min_attempts, 10);
  
  -- 疑わしいIPをブロック
  FOR suspicious_ip IN 
    SELECT * FROM suspicious_recaptcha_activity 
    WHERE failure_rate_percent >= threshold 
    AND total_attempts >= min_attempts
  LOOP
    -- 既にブロックされていない場合のみ追加
    INSERT INTO blocked_ips (
      ip_address, 
      reason, 
      total_attempts, 
      failed_attempts,
      blocked_until
    ) 
    VALUES (
      suspicious_ip.ip_address,
      'Auto-blocked: High reCAPTCHA failure rate (' || suspicious_ip.failure_rate_percent || '%)',
      suspicious_ip.total_attempts,
      suspicious_ip.failed_attempts,
      NOW() + INTERVAL '24 hours' -- 24時間ブロック
    )
    ON CONFLICT (ip_address) DO UPDATE SET
      total_attempts = EXCLUDED.total_attempts,
      failed_attempts = EXCLUDED.failed_attempts,
      blocked_until = EXCLUDED.blocked_until,
      is_active = true;
    
    blocked_count := blocked_count + 1;
  END LOOP;
  
  RETURN blocked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 期限切れIPブロックの自動解除関数
CREATE OR REPLACE FUNCTION cleanup_expired_ip_blocks() RETURNS INTEGER AS $$
DECLARE
  unblocked_count INTEGER := 0;
BEGIN
  UPDATE blocked_ips 
  SET is_active = false
  WHERE blocked_until < NOW() 
  AND is_active = true;
  
  GET DIAGNOSTICS unblocked_count = ROW_COUNT;
  
  RETURN unblocked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- reCAPTCHA統計分析関数
CREATE OR REPLACE FUNCTION get_recaptcha_analytics(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
  end_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  metric VARCHAR,
  value NUMERIC,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT 
      COUNT(*) as total_attempts,
      COUNT(*) FILTER (WHERE success = true) as successful_attempts,
      COUNT(*) FILTER (WHERE success = false) as failed_attempts,
      COUNT(*) FILTER (WHERE user_type = 'guest') as guest_attempts,
      COUNT(DISTINCT ip_address) as unique_ips,
      AVG(response_time_ms) as avg_response_time
    FROM recaptcha_logs
    WHERE DATE(created_at) BETWEEN start_date AND end_date
  )
  SELECT 'total_attempts'::VARCHAR, total_attempts::NUMERIC, 'Total reCAPTCHA attempts'::TEXT FROM stats
  UNION ALL
  SELECT 'success_rate', (successful_attempts * 100.0 / NULLIF(total_attempts, 0))::NUMERIC, 'Success rate percentage' FROM stats
  UNION ALL
  SELECT 'guest_percentage', (guest_attempts * 100.0 / NULLIF(total_attempts, 0))::NUMERIC, 'Guest user percentage' FROM stats
  UNION ALL
  SELECT 'unique_ips', unique_ips::NUMERIC, 'Unique IP addresses' FROM stats
  UNION ALL
  SELECT 'avg_response_time', avg_response_time::NUMERIC, 'Average response time (ms)' FROM stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- reCAPTCHA検証履歴のクリーンアップ（古いログの削除）
CREATE OR REPLACE FUNCTION cleanup_old_recaptcha_logs(
  retention_days INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  DELETE FROM recaptcha_logs 
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 定期実行スケジュール（pg_cronが利用可能な場合）
-- SELECT cron.schedule('cleanup-recaptcha-logs', '0 2 * * *', 'SELECT cleanup_old_recaptcha_logs(30);');
-- SELECT cron.schedule('auto-block-ips', '*/10 * * * *', 'SELECT auto_block_suspicious_ips();');
-- SELECT cron.schedule('cleanup-ip-blocks', '0 */6 * * *', 'SELECT cleanup_expired_ip_blocks();');

-- セキュリティ権限設定
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON recaptcha_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_recaptcha_analytics(DATE, DATE) TO authenticated;