// 1日あたりの画像生成回数制限ライブラリ
// Freeユーザーは1日10回まで、制限超過時は429エラー

import { supabase } from './supabase';
import { getUserSubscription } from './subscription';

// 1日あたりの生成回数制限
export const DAILY_GENERATION_LIMITS = {
  free: 10,
  premium: 50,
  pro: -1 // 無制限
} as const;

// 今日の使用統計
export interface DailyUsageStats {
  userId: string;
  date: string; // YYYY-MM-DD
  imageGenerationCount: number;
  poseExtractionCount: number;
  lastUpdated: string;
}

// 制限チェック結果
export interface DailyLimitResult {
  canGenerate: boolean;
  currentCount: number;
  limit: number;
  remainingCount: number;
  resetTime: string; // 次回リセット時刻
  message?: string;
}

/**
 * 今日の日付を YYYY-MM-DD 形式で取得
 */
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 明日の00:00のタイムスタンプを取得（制限リセット時刻）
 */
function getTomorrowResetTime(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

/**
 * ユーザーの1日あたりの生成制限を取得
 */
export function getDailyGenerationLimit(userId: string): number {
  const subscription = getUserSubscription(userId);
  return DAILY_GENERATION_LIMITS[subscription.plan] || DAILY_GENERATION_LIMITS.free;
}

/**
 * 今日の使用統計を取得（存在しない場合は作成）
 */
export async function getTodayUsageStats(userId: string): Promise<DailyUsageStats | null> {
  try {
    const today = getTodayString();

    // 今日の統計レコードを取得
    const { data, error } = await supabase
      .from('daily_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = レコードが見つからない
      console.error('今日の使用統計取得エラー:', error);
      return null;
    }

    // レコードが存在する場合はそのまま返す
    if (data) {
      return {
        userId: data.user_id,
        date: data.date,
        imageGenerationCount: data.image_generation_count || 0,
        poseExtractionCount: data.pose_extraction_count || 0,
        lastUpdated: data.updated_at
      };
    }

    // レコードが存在しない場合は新規作成
    const newRecord = {
      user_id: userId,
      date: today,
      image_generation_count: 0,
      pose_extraction_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: createdData, error: createError } = await supabase
      .from('daily_usage')
      .insert([newRecord])
      .select()
      .single();

    if (createError) {
      console.error('使用統計レコード作成エラー:', createError);
      return null;
    }

    return {
      userId: createdData.user_id,
      date: createdData.date,
      imageGenerationCount: createdData.image_generation_count || 0,
      poseExtractionCount: createdData.pose_extraction_count || 0,
      lastUpdated: createdData.updated_at
    };

  } catch (error) {
    console.error('使用統計取得中にエラーが発生:', error);
    return null;
  }
}

/**
 * 画像生成制限をチェック
 */
export async function checkDailyGenerationLimit(userId: string): Promise<DailyLimitResult> {
  try {
    const limit = getDailyGenerationLimit(userId);

    // 無制限の場合（Proプラン）
    if (limit === -1) {
      return {
        canGenerate: true,
        currentCount: 0,
        limit: -1,
        remainingCount: -1,
        resetTime: getTomorrowResetTime()
      };
    }

    // 今日の使用統計を取得
    const stats = await getTodayUsageStats(userId);
    if (!stats) {
      return {
        canGenerate: false,
        currentCount: 0,
        limit,
        remainingCount: 0,
        resetTime: getTomorrowResetTime(),
        message: '使用統計の取得に失敗しました'
      };
    }

    const currentCount = stats.imageGenerationCount;
    const remainingCount = Math.max(0, limit - currentCount);
    const canGenerate = currentCount < limit;

    return {
      canGenerate,
      currentCount,
      limit,
      remainingCount,
      resetTime: getTomorrowResetTime(),
      message: canGenerate 
        ? undefined 
        : `本日の画像生成制限（${limit}回）に達しました。明日00:00にリセットされます。`
    };

  } catch (error) {
    console.error('制限チェック中にエラーが発生:', error);
    return {
      canGenerate: false,
      currentCount: 0,
      limit: getDailyGenerationLimit(userId),
      remainingCount: 0,
      resetTime: getTomorrowResetTime(),
      message: '制限チェック中にエラーが発生しました'
    };
  }
}

/**
 * 画像生成回数をインクリメント
 */
export async function incrementDailyGenerationCount(userId: string): Promise<{
  success: boolean;
  newCount: number;
  message?: string;
}> {
  try {
    // 制限チェック
    const limitResult = await checkDailyGenerationLimit(userId);
    if (!limitResult.canGenerate) {
      return {
        success: false,
        newCount: limitResult.currentCount,
        message: limitResult.message || '生成制限に達しています'
      };
    }

    const today = getTodayString();

    // カウントをインクリメント
    const { data, error } = await supabase
      .from('daily_usage')
      .update({
        image_generation_count: limitResult.currentCount + 1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('date', today)
      .select()
      .single();

    if (error) {
      console.error('生成回数インクリメントエラー:', error);
      return {
        success: false,
        newCount: limitResult.currentCount,
        message: '生成回数の更新に失敗しました'
      };
    }

    const newCount = data.image_generation_count;
    console.log(`生成回数更新: ${userId} - ${newCount}/${limitResult.limit}`);

    return {
      success: true,
      newCount,
      message: `画像を生成しました（${newCount}/${limitResult.limit === -1 ? '無制限' : limitResult.limit}）`
    };

  } catch (error) {
    console.error('生成回数インクリメント中にエラーが発生:', error);
    return {
      success: false,
      newCount: 0,
      message: '生成回数の更新中にエラーが発生しました'
    };
  }
}

/**
 * ポーズ抽出回数をインクリメント
 */
export async function incrementDailyPoseExtractionCount(userId: string): Promise<{
  success: boolean;
  newCount: number;
  message?: string;
}> {
  try {
    const stats = await getTodayUsageStats(userId);
    if (!stats) {
      return {
        success: false,
        newCount: 0,
        message: '使用統計の取得に失敗しました'
      };
    }

    const today = getTodayString();

    const { data, error } = await supabase
      .from('daily_usage')
      .update({
        pose_extraction_count: stats.poseExtractionCount + 1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('date', today)
      .select()
      .single();

    if (error) {
      console.error('ポーズ抽出回数インクリメントエラー:', error);
      return {
        success: false,
        newCount: stats.poseExtractionCount,
        message: 'ポーズ抽出回数の更新に失敗しました'
      };
    }

    return {
      success: true,
      newCount: data.pose_extraction_count,
      message: 'ポーズ抽出を実行しました'
    };

  } catch (error) {
    console.error('ポーズ抽出回数インクリメント中にエラーが発生:', error);
    return {
      success: false,
      newCount: 0,
      message: 'ポーズ抽出回数の更新中にエラーが発生しました'
    };
  }
}

/**
 * 過去の使用統計を取得
 */
export async function getUsageHistory(
  userId: string, 
  days: number = 7
): Promise<DailyUsageStats[]> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days + 1);

    const { data, error } = await supabase
      .from('daily_usage')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) {
      console.error('使用履歴取得エラー:', error);
      return [];
    }

    return (data || []).map(record => ({
      userId: record.user_id,
      date: record.date,
      imageGenerationCount: record.image_generation_count || 0,
      poseExtractionCount: record.pose_extraction_count || 0,
      lastUpdated: record.updated_at
    }));

  } catch (error) {
    console.error('使用履歴取得中にエラーが発生:', error);
    return [];
  }
}

/**
 * 使用統計のサマリーを取得
 */
export async function getDailyUsageSummary(userId: string): Promise<{
  today: DailyUsageStats | null;
  limit: DailyLimitResult;
  weeklyTotal: {
    imageGeneration: number;
    poseExtraction: number;
  };
  planInfo: {
    name: string;
    generationLimit: number;
  };
}> {
  try {
    const [today, limitResult, weeklyHistory] = await Promise.all([
      getTodayUsageStats(userId),
      checkDailyGenerationLimit(userId),
      getUsageHistory(userId, 7)
    ]);

    const weeklyTotal = weeklyHistory.reduce(
      (total, day) => ({
        imageGeneration: total.imageGeneration + day.imageGenerationCount,
        poseExtraction: total.poseExtraction + day.poseExtractionCount
      }),
      { imageGeneration: 0, poseExtraction: 0 }
    );

    const subscription = getUserSubscription(userId);

    return {
      today,
      limit: limitResult,
      weeklyTotal,
      planInfo: {
        name: subscription.plan,
        generationLimit: getDailyGenerationLimit(userId)
      }
    };

  } catch (error) {
    console.error('使用統計サマリー取得中にエラーが発生:', error);
    const limit = getDailyGenerationLimit(userId);
    const subscription = getUserSubscription(userId);

    return {
      today: null,
      limit: {
        canGenerate: false,
        currentCount: 0,
        limit,
        remainingCount: limit === -1 ? -1 : limit,
        resetTime: getTomorrowResetTime(),
        message: 'データの取得に失敗しました'
      },
      weeklyTotal: { imageGeneration: 0, poseExtraction: 0 },
      planInfo: {
        name: subscription.plan,
        generationLimit: limit
      }
    };
  }
}

/**
 * 古い使用統計データをクリーンアップ（30日以上前のデータを削除）
 */
export async function cleanupOldUsageData(): Promise<{
  success: boolean;
  deletedCount: number;
  message: string;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_usage')
      .delete()
      .lt('date', cutoffDateString)
      .select('date');

    if (error) {
      console.error('古い使用統計データ削除エラー:', error);
      return {
        success: false,
        deletedCount: 0,
        message: '古いデータの削除に失敗しました'
      };
    }

    const deletedCount = data?.length || 0;
    console.log(`古い使用統計データ${deletedCount}件を削除しました`);

    return {
      success: true,
      deletedCount,
      message: `${deletedCount}件の古いデータを削除しました`
    };

  } catch (error) {
    console.error('使用統計クリーンアップ中にエラーが発生:', error);
    return {
      success: false,
      deletedCount: 0,
      message: 'クリーンアップ中にエラーが発生しました'
    };
  }
}

/**
 * React Hook: 1日の使用制限管理
 */
import { useState, useEffect } from 'react';

export function useDailyLimit(userId: string) {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getDailyUsageSummary>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSummary = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const newSummary = await getDailyUsageSummary(userId);
      setSummary(newSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : '統計の取得に失敗しました');
      console.error('Daily limit summary error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      refreshSummary();
    }
  }, [userId]);

  const incrementGeneration = async () => {
    if (!userId) return { success: false, newCount: 0, message: 'ユーザーIDが不明です' };
    
    const result = await incrementDailyGenerationCount(userId);
    if (result.success) {
      // 統計を更新
      await refreshSummary();
    }
    return result;
  };

  const incrementPoseExtraction = async () => {
    if (!userId) return { success: false, newCount: 0, message: 'ユーザーIDが不明です' };
    
    const result = await incrementDailyPoseExtractionCount(userId);
    if (result.success) {
      // 統計を更新
      await refreshSummary();
    }
    return result;
  };

  return {
    summary,
    isLoading,
    error,
    refreshSummary,
    incrementGeneration,
    incrementPoseExtraction
  };
}