-- 日次生成回数制限テーブルのスキーマ
-- 1日10回の生成制限を実装

-- 日次生成統計テーブル
CREATE TABLE IF NOT EXISTS daily_generation_stats (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id text NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    generation_count integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- 制約: 1ユーザー1日1レコード
    UNIQUE(user_id, date)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_daily_generation_stats_user_id ON daily_generation_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_generation_stats_date ON daily_generation_stats(date);
CREATE INDEX IF NOT EXISTS idx_daily_generation_stats_user_date ON daily_generation_stats(user_id, date);

-- Row Level Security (RLS) を有効化
ALTER TABLE daily_generation_stats ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: 自分のレコードのみアクセス可能
CREATE POLICY "Users can view own daily generation stats" ON daily_generation_stats
    FOR SELECT USING (auth.uid()::text = user_id OR user_id = 'guest');

CREATE POLICY "Users can insert own daily generation stats" ON daily_generation_stats
    FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id = 'guest');

CREATE POLICY "Users can update own daily generation stats" ON daily_generation_stats
    FOR UPDATE USING (auth.uid()::text = user_id OR user_id = 'guest');

-- ゲストユーザー用の特別なポリシー（IPアドレスベース）
CREATE TABLE IF NOT EXISTS guest_generation_stats (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address text NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    generation_count integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- 制約: 1IP1日1レコード
    UNIQUE(ip_address, date)
);

-- ゲストテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_guest_generation_stats_ip ON guest_generation_stats(ip_address);
CREATE INDEX IF NOT EXISTS idx_guest_generation_stats_date ON guest_generation_stats(date);
CREATE INDEX IF NOT EXISTS idx_guest_generation_stats_ip_date ON guest_generation_stats(ip_address, date);

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- daily_generation_stats用トリガー
CREATE TRIGGER update_daily_generation_stats_updated_at 
    BEFORE UPDATE ON daily_generation_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- guest_generation_stats用トリガー
CREATE TRIGGER update_guest_generation_stats_updated_at 
    BEFORE UPDATE ON guest_generation_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 日次制限チェック関数
CREATE OR REPLACE FUNCTION check_daily_generation_limit(
    p_user_id text,
    p_ip_address text DEFAULT NULL,
    p_limit integer DEFAULT 10
)
RETURNS jsonb AS $$
DECLARE
    current_count integer := 0;
    today_date date := CURRENT_DATE;
    result jsonb;
BEGIN
    -- 認証ユーザーの場合
    IF p_user_id != 'guest' AND p_user_id IS NOT NULL THEN
        SELECT COALESCE(generation_count, 0) INTO current_count
        FROM daily_generation_stats
        WHERE user_id = p_user_id AND date = today_date;
        
        result := jsonb_build_object(
            'user_id', p_user_id,
            'current_count', current_count,
            'limit', p_limit,
            'remaining', GREATEST(0, p_limit - current_count),
            'can_generate', current_count < p_limit,
            'reset_time', (today_date + interval '1 day')::text
        );
    
    -- ゲストユーザーの場合（IPアドレスベース）
    ELSE
        IF p_ip_address IS NULL THEN
            RAISE EXCEPTION 'IPアドレスが必要です';
        END IF;
        
        SELECT COALESCE(generation_count, 0) INTO current_count
        FROM guest_generation_stats
        WHERE ip_address = p_ip_address AND date = today_date;
        
        result := jsonb_build_object(
            'user_id', 'guest',
            'ip_address', p_ip_address,
            'current_count', current_count,
            'limit', p_limit,
            'remaining', GREATEST(0, p_limit - current_count),
            'can_generate', current_count < p_limit,
            'reset_time', (today_date + interval '1 day')::text
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 生成回数増加関数
CREATE OR REPLACE FUNCTION increment_daily_generation_count(
    p_user_id text,
    p_ip_address text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    current_count integer := 0;
    new_count integer := 0;
    today_date date := CURRENT_DATE;
    result jsonb;
BEGIN
    -- 認証ユーザーの場合
    IF p_user_id != 'guest' AND p_user_id IS NOT NULL THEN
        -- UPSERT: レコードが存在すれば更新、なければ挿入
        INSERT INTO daily_generation_stats (user_id, date, generation_count)
        VALUES (p_user_id, today_date, 1)
        ON CONFLICT (user_id, date) 
        DO UPDATE SET 
            generation_count = daily_generation_stats.generation_count + 1,
            updated_at = timezone('utc'::text, now())
        RETURNING generation_count INTO new_count;
        
        result := jsonb_build_object(
            'user_id', p_user_id,
            'date', today_date,
            'new_count', new_count,
            'success', true
        );
    
    -- ゲストユーザーの場合
    ELSE
        IF p_ip_address IS NULL THEN
            RAISE EXCEPTION 'IPアドレスが必要です';
        END IF;
        
        INSERT INTO guest_generation_stats (ip_address, date, generation_count)
        VALUES (p_ip_address, today_date, 1)
        ON CONFLICT (ip_address, date) 
        DO UPDATE SET 
            generation_count = guest_generation_stats.generation_count + 1,
            updated_at = timezone('utc'::text, now())
        RETURNING generation_count INTO new_count;
        
        result := jsonb_build_object(
            'user_id', 'guest',
            'ip_address', p_ip_address,
            'date', today_date,
            'new_count', new_count,
            'success', true
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 制限リセット関数（日次バッチ処理用）
CREATE OR REPLACE FUNCTION reset_daily_generation_limits()
RETURNS jsonb AS $$
DECLARE
    deleted_auth_count integer;
    deleted_guest_count integer;
    cutoff_date date := CURRENT_DATE - interval '7 days';
BEGIN
    -- 7日前より古いレコードを削除
    DELETE FROM daily_generation_stats WHERE date < cutoff_date;
    GET DIAGNOSTICS deleted_auth_count = ROW_COUNT;
    
    DELETE FROM guest_generation_stats WHERE date < cutoff_date;
    GET DIAGNOSTICS deleted_guest_count = ROW_COUNT;
    
    RETURN jsonb_build_object(
        'success', true,
        'deleted_auth_records', deleted_auth_count,
        'deleted_guest_records', deleted_guest_count,
        'cutoff_date', cutoff_date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 統計取得関数
CREATE OR REPLACE FUNCTION get_generation_statistics(
    p_user_id text,
    p_ip_address text DEFAULT NULL,
    p_days integer DEFAULT 7
)
RETURNS jsonb AS $$
DECLARE
    stats jsonb;
    start_date date := CURRENT_DATE - (p_days - 1);
BEGIN
    -- 認証ユーザーの場合
    IF p_user_id != 'guest' AND p_user_id IS NOT NULL THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', date,
                'count', generation_count
            ) ORDER BY date DESC
        ) INTO stats
        FROM daily_generation_stats
        WHERE user_id = p_user_id 
        AND date >= start_date;
    
    -- ゲストユーザーの場合
    ELSE
        IF p_ip_address IS NULL THEN
            RAISE EXCEPTION 'IPアドレスが必要です';
        END IF;
        
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', date,
                'count', generation_count
            ) ORDER BY date DESC
        ) INTO stats
        FROM guest_generation_stats
        WHERE ip_address = p_ip_address 
        AND date >= start_date;
    END IF;
    
    RETURN COALESCE(stats, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 管理者用の統計取得関数
CREATE OR REPLACE FUNCTION get_admin_generation_statistics(
    p_start_date date DEFAULT CURRENT_DATE - 30,
    p_end_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb AS $$
DECLARE
    result jsonb;
BEGIN
    -- 管理者権限チェック（必要に応じて実装）
    -- IF NOT is_admin() THEN
    --     RAISE EXCEPTION 'アクセス権限がありません';
    -- END IF;
    
    SELECT jsonb_build_object(
        'auth_users', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'date', date,
                    'total_generations', COALESCE(SUM(generation_count), 0),
                    'unique_users', COUNT(DISTINCT user_id)
                )
            )
            FROM daily_generation_stats
            WHERE date BETWEEN p_start_date AND p_end_date
            GROUP BY date
            ORDER BY date DESC
        ),
        'guest_users', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'date', date,
                    'total_generations', COALESCE(SUM(generation_count), 0),
                    'unique_ips', COUNT(DISTINCT ip_address)
                )
            )
            FROM guest_generation_stats
            WHERE date BETWEEN p_start_date AND p_end_date
            GROUP BY date
            ORDER BY date DESC
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- サンプルデータの挿入（開発・テスト用）
-- INSERT INTO daily_generation_stats (user_id, date, generation_count)
-- VALUES 
--     ('test-user-1', CURRENT_DATE, 5),
--     ('test-user-2', CURRENT_DATE, 10),
--     ('test-user-1', CURRENT_DATE - 1, 8);

-- INSERT INTO guest_generation_stats (ip_address, date, generation_count)
-- VALUES 
--     ('192.168.1.100', CURRENT_DATE, 3),
--     ('10.0.0.50', CURRENT_DATE, 10);

-- 使用例クエリ
-- SELECT check_daily_generation_limit('test-user-1');
-- SELECT check_daily_generation_limit('guest', '192.168.1.100');
-- SELECT increment_daily_generation_count('test-user-1');
-- SELECT increment_daily_generation_count('guest', '192.168.1.100');