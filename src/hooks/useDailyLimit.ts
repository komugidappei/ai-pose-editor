'use client';

// 日次制限管理用のReactフック
// フロントエンドで日次制限の状況を管理

import { useState, useEffect, useCallback } from 'react';
import { DailyLimitStatus } from '@/lib/dailyGenerationLimit';

interface UseDailyLimitOptions {
  userId?: string;
  isAuthenticated?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseDailyLimitReturn {
  limitStatus: DailyLimitStatus | null;
  loading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
  checkCanGenerate: () => boolean;
  getRemainingCount: () => number;
  getStatusMessage: () => string;
  isNearLimit: () => boolean;
}

/**
 * 日次制限の状況を管理するカスタムフック
 */
export function useDailyLimit(options: UseDailyLimitOptions = {}): UseDailyLimitReturn {
  const {
    userId = 'guest',
    isAuthenticated = false,
    autoRefresh = true,
    refreshInterval = 60000 // 1分
  } = options;

  const [limitStatus, setLimitStatus] = useState<DailyLimitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 制限状況をサーバーから取得
   */
  const fetchLimitStatus = useCallback(async (): Promise<DailyLimitStatus | null> => {
    try {
      const response = await fetch('/api/daily-limit/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(isAuthenticated && {
            'Authorization': `Bearer ${await getAuthToken()}`
          })
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          // 制限に達している場合でもデータを取得
          const data = await response.json();
          return data.limitStatus || null;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.limitStatus || null;
    } catch (err) {
      console.error('制限状況の取得に失敗:', err);
      throw err;
    }
  }, [isAuthenticated]);

  /**
   * 制限状況を更新
   */
  const refreshStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const status = await fetchLimitStatus();
      setLimitStatus(status);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '制限状況の取得に失敗しました';
      setError(errorMessage);
      console.error('Refresh status error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchLimitStatus]);

  /**
   * 生成可能かどうかをチェック
   */
  const checkCanGenerate = useCallback((): boolean => {
    return limitStatus?.canGenerate ?? false;
  }, [limitStatus]);

  /**
   * 残り生成回数を取得
   */
  const getRemainingCount = useCallback((): number => {
    return limitStatus?.remaining ?? 0;
  }, [limitStatus]);

  /**
   * 状況メッセージを取得
   */
  const getStatusMessage = useCallback((): string => {
    if (!limitStatus) return '制限状況を確認中...';
    
    if (!limitStatus.canGenerate) {
      return `本日の生成制限（${limitStatus.limit}回）に達しています`;
    }
    
    return `残り${limitStatus.remaining}回 / ${limitStatus.limit}回`;
  }, [limitStatus]);

  /**
   * 制限に近いかどうかをチェック
   */
  const isNearLimit = useCallback((): boolean => {
    if (!limitStatus) return false;
    return limitStatus.remaining <= 2 && limitStatus.canGenerate;
  }, [limitStatus]);

  /**
   * 認証トークンを取得（Supabaseの場合）
   */
  const getAuthToken = async (): Promise<string> => {
    try {
      // Supabase Auth からトークンを取得
      if (typeof window !== 'undefined') {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token || '';
      }
      return '';
    } catch (error) {
      console.error('認証トークンの取得に失敗:', error);
      return '';
    }
  };

  // 初回ロード
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // 自動更新
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // エラー状態の場合は再試行
      if (error || !limitStatus) {
        refreshStatus();
      } else if (limitStatus.canGenerate) {
        // 制限に余裕がある場合のみ定期更新
        refreshStatus();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshStatus, error, limitStatus]);

  // リセット時刻が過ぎた場合の自動更新
  useEffect(() => {
    if (!limitStatus?.resetTime) return;

    const resetTime = new Date(limitStatus.resetTime).getTime();
    const now = Date.now();
    const timeUntilReset = resetTime - now;

    if (timeUntilReset <= 0) {
      // すでにリセット時刻を過ぎている場合は即座に更新
      refreshStatus();
      return;
    }

    // リセット時刻に自動更新
    const timeout = setTimeout(() => {
      refreshStatus();
    }, timeUntilReset + 1000); // 1秒後に更新

    return () => clearTimeout(timeout);
  }, [limitStatus?.resetTime, refreshStatus]);

  return {
    limitStatus,
    loading,
    error,
    refreshStatus,
    checkCanGenerate,
    getRemainingCount,
    getStatusMessage,
    isNearLimit
  };
}

/**
 * 日次制限の状況チェック専用フック（軽量版）
 */
export function useDailyLimitCheck(userId?: string, isAuthenticated?: boolean) {
  const { limitStatus, checkCanGenerate, getRemainingCount, isNearLimit } = useDailyLimit({
    userId,
    isAuthenticated,
    autoRefresh: false // 自動更新は無効
  });

  return {
    canGenerate: checkCanGenerate(),
    remaining: getRemainingCount(),
    isNearLimit: isNearLimit(),
    limitStatus
  };
}

/**
 * 制限状況の監視専用フック（リアルタイム更新）
 */
export function useDailyLimitMonitor(
  userId?: string, 
  isAuthenticated?: boolean,
  onLimitReached?: () => void,
  onNearLimit?: () => void
) {
  const { limitStatus, refreshStatus } = useDailyLimit({
    userId,
    isAuthenticated,
    autoRefresh: true,
    refreshInterval: 30000 // 30秒間隔
  });

  // 制限到達時のコールバック
  useEffect(() => {
    if (!limitStatus) return;

    if (!limitStatus.canGenerate && onLimitReached) {
      onLimitReached();
    } else if (limitStatus.remaining <= 2 && limitStatus.canGenerate && onNearLimit) {
      onNearLimit();
    }
  }, [limitStatus, onLimitReached, onNearLimit]);

  return {
    limitStatus,
    refreshStatus
  };
}

/**
 * 生成実行前の制限チェック用フック
 */
export function usePreGenerationCheck(userId?: string, isAuthenticated?: boolean) {
  const { limitStatus, refreshStatus, loading } = useDailyLimit({
    userId,
    isAuthenticated,
    autoRefresh: false
  });

  /**
   * 生成前の制限チェック
   */
  const checkBeforeGeneration = useCallback(async (): Promise<{
    canProceed: boolean;
    message?: string;
    limitStatus: DailyLimitStatus | null;
  }> => {
    // 最新の状況を取得
    await refreshStatus();

    if (!limitStatus) {
      return {
        canProceed: false,
        message: '制限状況を確認できませんでした',
        limitStatus: null
      };
    }

    if (!limitStatus.canGenerate) {
      return {
        canProceed: false,
        message: `本日の生成制限（${limitStatus.limit}回）に達しています`,
        limitStatus
      };
    }

    return {
      canProceed: true,
      limitStatus
    };
  }, [limitStatus, refreshStatus]);

  return {
    checkBeforeGeneration,
    loading,
    limitStatus
  };
}