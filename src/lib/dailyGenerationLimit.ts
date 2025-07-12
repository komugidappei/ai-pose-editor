// 日次生成回数制限管理ライブラリ
// 1日10回の生成制限をSupabaseで管理

import { createClient } from '@supabase/supabase-js';

// Supabaseクライアントの初期化
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// サービスロールキーを使用（RLS回避のため）
const supabaseService = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export interface DailyLimitStatus {
  userId: string;
  ipAddress?: string;
  currentCount: number;
  limit: number;
  remaining: number;
  canGenerate: boolean;
  resetTime: string;
  isGuest: boolean;
}

export interface GenerationResult {
  success: boolean;
  newCount: number;
  limitReached: boolean;
  message?: string;
}

/**
 * IPアドレスを取得する関数
 */
export function getClientIpAddress(request: Request): string {
  // Vercel, Netlify, CloudFlare などの環境に対応
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cloudflareIp = request.headers.get('cf-connecting-ip');
  
  if (cloudflareIp) return cloudflareIp;
  if (realIp) return realIp;
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  
  // フォールバック
  return '127.0.0.1';
}

/**
 * 日次生成制限をチェック
 */
export async function checkDailyGenerationLimit(
  userId: string,
  ipAddress?: string,
  limit: number = 10
): Promise<DailyLimitStatus> {
  try {
    const { data, error } = await supabaseService.rpc('check_daily_generation_limit', {
      p_user_id: userId,
      p_ip_address: ipAddress,
      p_limit: limit
    });

    if (error) {
      console.error('Daily limit check error:', error);
      throw new Error(`制限チェックに失敗しました: ${error.message}`);
    }

    return {
      userId: data.user_id,
      ipAddress: data.ip_address,
      currentCount: data.current_count,
      limit: data.limit,
      remaining: data.remaining,
      canGenerate: data.can_generate,
      resetTime: data.reset_time,
      isGuest: userId === 'guest'
    };
  } catch (error) {
    console.error('checkDailyGenerationLimit error:', error);
    
    // エラー時は安全側に倒して制限有りとする
    return {
      userId,
      ipAddress,
      currentCount: limit,
      limit,
      remaining: 0,
      canGenerate: false,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isGuest: userId === 'guest'
    };
  }
}

/**
 * 生成回数を増加
 */
export async function incrementDailyGenerationCount(
  userId: string,
  ipAddress?: string
): Promise<GenerationResult> {
  try {
    // まず制限チェック
    const limitStatus = await checkDailyGenerationLimit(userId, ipAddress);
    
    if (!limitStatus.canGenerate) {
      return {
        success: false,
        newCount: limitStatus.currentCount,
        limitReached: true,
        message: `1日の生成制限（${limitStatus.limit}回）に達しています。${limitStatus.resetTime}にリセットされます。`
      };
    }

    // 回数を増加
    const { data, error } = await supabaseService.rpc('increment_daily_generation_count', {
      p_user_id: userId,
      p_ip_address: ipAddress
    });

    if (error) {
      console.error('Generation count increment error:', error);
      throw new Error(`生成回数の更新に失敗しました: ${error.message}`);
    }

    const newCount = data.new_count;
    const limitReached = newCount >= limitStatus.limit;

    return {
      success: true,
      newCount,
      limitReached,
      message: limitReached 
        ? `本日の生成制限（${limitStatus.limit}回）に達しました` 
        : `生成回数: ${newCount}/${limitStatus.limit}`
    };

  } catch (error) {
    console.error('incrementDailyGenerationCount error:', error);
    return {
      success: false,
      newCount: 0,
      limitReached: true,
      message: error instanceof Error ? error.message : '生成回数の更新に失敗しました'
    };
  }
}

/**
 * ユーザーの生成統計を取得
 */
export async function getGenerationStatistics(
  userId: string,
  ipAddress?: string,
  days: number = 7
): Promise<{ date: string; count: number }[]> {
  try {
    const { data, error } = await supabaseService.rpc('get_generation_statistics', {
      p_user_id: userId,
      p_ip_address: ipAddress,
      p_days: days
    });

    if (error) {
      console.error('Generation statistics error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('getGenerationStatistics error:', error);
    return [];
  }
}

/**
 * 管理者用の全体統計取得
 */
export async function getAdminGenerationStatistics(
  startDate?: Date,
  endDate?: Date
): Promise<{
  authUsers: { date: string; totalGenerations: number; uniqueUsers: number }[];
  guestUsers: { date: string; totalGenerations: number; uniqueIps: number }[];
}> {
  try {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const { data, error } = await supabaseService.rpc('get_admin_generation_statistics', {
      p_start_date: start.toISOString().split('T')[0],
      p_end_date: end.toISOString().split('T')[0]
    });

    if (error) {
      console.error('Admin statistics error:', error);
      return { authUsers: [], guestUsers: [] };
    }

    return {
      authUsers: data.auth_users || [],
      guestUsers: data.guest_users || []
    };
  } catch (error) {
    console.error('getAdminGenerationStatistics error:', error);
    return { authUsers: [], guestUsers: [] };
  }
}

/**
 * 日次制限のクリーンアップ（古いレコードの削除）
 */
export async function cleanupOldGenerationRecords(): Promise<{
  success: boolean;
  deletedAuthRecords: number;
  deletedGuestRecords: number;
}> {
  try {
    const { data, error } = await supabaseService.rpc('reset_daily_generation_limits');

    if (error) {
      console.error('Cleanup error:', error);
      return { success: false, deletedAuthRecords: 0, deletedGuestRecords: 0 };
    }

    return {
      success: data.success,
      deletedAuthRecords: data.deleted_auth_records,
      deletedGuestRecords: data.deleted_guest_records
    };
  } catch (error) {
    console.error('cleanupOldGenerationRecords error:', error);
    return { success: false, deletedAuthRecords: 0, deletedGuestRecords: 0 };
  }
}

/**
 * リクエストから安全にIPアドレスを抽出
 */
export function extractSafeIpAddress(request: Request): string {
  const ip = getClientIpAddress(request);
  
  // IPv4の正規表現パターン
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6の簡単なパターン
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  
  if (ipv4Pattern.test(ip) || ipv6Pattern.test(ip)) {
    return ip;
  }
  
  // 不正なIPアドレスの場合はハッシュ化
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

/**
 * デバイス固有の識別子を生成（ゲストユーザー用）
 */
export function generateGuestIdentifier(request: Request): string {
  const ip = extractSafeIpAddress(request);
  const userAgent = request.headers.get('user-agent') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  
  // IPアドレス + User-Agent + Accept-Language のハッシュ
  const crypto = require('crypto');
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${ip}:${userAgent}:${acceptLanguage}`)
    .digest('hex')
    .substring(0, 32);
    
  return fingerprint;
}

/**
 * 制限状況のメッセージを生成
 */
export function formatLimitMessage(status: DailyLimitStatus): string {
  if (status.canGenerate) {
    return `生成可能回数: ${status.remaining}回 / ${status.limit}回`;
  } else {
    const resetDate = new Date(status.resetTime);
    const resetTimeStr = resetDate.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `1日の生成制限（${status.limit}回）に達しています。明日の${resetTimeStr}にリセットされます。`;
  }
}

/**
 * Rate Limiting用のレスポンスヘッダーを生成
 */
export function generateRateLimitHeaders(status: DailyLimitStatus): HeadersInit {
  const resetTime = Math.floor(new Date(status.resetTime).getTime() / 1000);
  
  return {
    'X-RateLimit-Limit': status.limit.toString(),
    'X-RateLimit-Remaining': status.remaining.toString(),
    'X-RateLimit-Reset': resetTime.toString(),
    'X-RateLimit-Policy': 'daily-generation-limit'
  };
}

/**
 * エラーレスポンス生成（429 Too Many Requests）
 */
export function createRateLimitErrorResponse(status: DailyLimitStatus): Response {
  const message = formatLimitMessage(status);
  const headers = generateRateLimitHeaders(status);
  
  return new Response(
    JSON.stringify({
      error: 'TOO_MANY_REQUESTS',
      message,
      details: {
        currentCount: status.currentCount,
        limit: status.limit,
        resetTime: status.resetTime,
        isGuest: status.isGuest
      }
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
}

/**
 * 成功レスポンスにRate Limitヘッダーを追加
 */
export function addRateLimitHeaders(response: Response, status: DailyLimitStatus): Response {
  const headers = generateRateLimitHeaders(status);
  
  // 既存のヘッダーに追加
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  
  return response;
}

/**
 * 開発環境でのテスト用ヘルパー
 */
export async function resetDailyLimitForTesting(userId: string, ipAddress?: string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('resetDailyLimitForTesting は開発環境でのみ使用可能です');
    return false;
  }

  try {
    if (userId === 'guest' && ipAddress) {
      const { error } = await supabaseService
        .from('guest_generation_stats')
        .delete()
        .eq('ip_address', ipAddress)
        .eq('date', new Date().toISOString().split('T')[0]);
      
      return !error;
    } else {
      const { error } = await supabaseService
        .from('daily_generation_stats')
        .delete()
        .eq('user_id', userId)
        .eq('date', new Date().toISOString().split('T')[0]);
      
      return !error;
    }
  } catch (error) {
    console.error('Test reset error:', error);
    return false;
  }
}