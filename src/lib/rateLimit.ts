// Next.js用レート制限ライブラリ
// IPごとにAPIアクセス回数を制限

import { NextRequest, NextResponse } from 'next/server';

// レート制限設定の型定義
interface RateLimitOptions {
  windowMs: number; // 時間ウィンドウ（ミリ秒）
  max: number; // 最大リクエスト数
  message: string; // 制限時のメッセージ
  statusCode?: number; // レスポンスステータスコード
  skipSuccessfulRequests?: boolean; // 成功したリクエストをカウントしない
  skipFailedRequests?: boolean; // 失敗したリクエストをカウントしない
  keyGenerator?: (request: NextRequest) => string; // キー生成関数
}

// レート制限レコードの型定義
interface RateLimitRecord {
  count: number;
  resetTime: number;
  firstRequestTime: number;
}

// メモリベースのストア（本番環境ではRedisなどを使用）
class MemoryStore {
  private store = new Map<string, RateLimitRecord>();

  get(key: string): RateLimitRecord | undefined {
    return this.store.get(key);
  }

  set(key: string, record: RateLimitRecord): void {
    this.store.set(key, record);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  // 期限切れエントリを削除
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }

  // 全データをクリア
  clear(): void {
    this.store.clear();
  }

  // 現在の状態を取得（デバッグ用）
  getStats(): { totalKeys: number; activeKeys: number } {
    const now = Date.now();
    let activeKeys = 0;
    
    for (const [, record] of this.store.entries()) {
      if (now <= record.resetTime) {
        activeKeys++;
      }
    }

    return {
      totalKeys: this.store.size,
      activeKeys
    };
  }
}

// グローバルストア
const store = new MemoryStore();

// 定期的にクリーンアップ（5分間隔）
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    store.cleanup();
  }, 5 * 60 * 1000);
}

/**
 * デフォルトキー生成関数（IPアドレスベース）
 */
function defaultKeyGenerator(request: NextRequest): string {
  // IPアドレスを取得（プロキシ経由も考慮）
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const remoteAddr = request.headers.get('remote-addr');
  
  if (forwarded) {
    // 複数のIPがある場合は最初のものを使用
    return forwarded.split(',')[0].trim();
  }
  
  return realIp || remoteAddr || 'unknown';
}

/**
 * レート制限ミドルウェア
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message,
    statusCode = 429,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator
  } = options;

  return async (request: NextRequest): Promise<{
    success: boolean;
    response?: NextResponse;
    remaining?: number;
    resetTime?: number;
  }> => {
    try {
      const key = keyGenerator(request);
      const now = Date.now();
      
      // 既存のレコードを取得
      let record = store.get(key);
      
      // レコードがないか、ウィンドウがリセットされた場合
      if (!record || now > record.resetTime) {
        record = {
          count: 0,
          resetTime: now + windowMs,
          firstRequestTime: now
        };
        store.set(key, record);
      }

      // リクエスト数をインクリメント
      record.count++;
      store.set(key, record);

      // 制限チェック
      if (record.count > max) {
        const response = NextResponse.json(
          {
            error: message,
            retryAfter: Math.ceil((record.resetTime - now) / 1000),
            limit: max,
            remaining: 0,
            resetTime: new Date(record.resetTime).toISOString()
          },
          { status: statusCode }
        );

        // レート制限ヘッダーを追加
        response.headers.set('X-RateLimit-Limit', max.toString());
        response.headers.set('X-RateLimit-Remaining', '0');
        response.headers.set('X-RateLimit-Reset', record.resetTime.toString());
        response.headers.set('Retry-After', Math.ceil((record.resetTime - now) / 1000).toString());

        return {
          success: false,
          response
        };
      }

      // 成功時の情報を返す
      const remaining = Math.max(0, max - record.count);
      
      return {
        success: true,
        remaining,
        resetTime: record.resetTime
      };

    } catch (error) {
      console.error('レート制限チェック中にエラーが発生:', error);
      
      // エラー時は制限をスキップ（安全側に倒す）
      return { success: true };
    }
  };
}

/**
 * プリセット設定
 */
export const rateLimitPresets = {
  // 厳しい制限（重要なAPI用）
  strict: {
    windowMs: 60 * 1000, // 1分
    max: 5,
    message: 'アクセス回数が多すぎます。1分後に再試行してください。'
  },
  
  // 標準制限
  standard: {
    windowMs: 60 * 1000, // 1分
    max: 10,
    message: 'アクセス回数が多すぎます。しばらく待ってから再試行してください。'
  },
  
  // 緩い制限
  lenient: {
    windowMs: 60 * 1000, // 1分
    max: 30,
    message: 'アクセス回数が制限を超えました。少し待ってください。'
  },
  
  // 画像生成API用
  imageGeneration: {
    windowMs: 60 * 1000, // 1分
    max: 5,
    message: '画像生成の回数制限に達しました。1分後に再試行してください。'
  },
  
  // アップロード用
  upload: {
    windowMs: 60 * 1000, // 1分
    max: 3,
    message: 'アップロード回数が多すぎます。少し待ってから再試行してください。'
  }
};

/**
 * API Route用のレート制限ヘルパー
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: RateLimitOptions
) {
  const limiter = rateLimit(options);

  return async (request: NextRequest): Promise<NextResponse> => {
    // レート制限チェック
    const limitResult = await limiter(request);
    
    if (!limitResult.success && limitResult.response) {
      return limitResult.response;
    }

    // 制限内の場合は元のハンドラーを実行
    const response = await handler(request);
    
    // レスポンスヘッダーにレート制限情報を追加
    if (limitResult.remaining !== undefined) {
      response.headers.set('X-RateLimit-Limit', options.max.toString());
      response.headers.set('X-RateLimit-Remaining', limitResult.remaining.toString());
    }
    
    if (limitResult.resetTime) {
      response.headers.set('X-RateLimit-Reset', limitResult.resetTime.toString());
    }

    return response;
  };
}

/**
 * レート制限状態の確認
 */
export async function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): Promise<{
  isLimited: boolean;
  remaining: number;
  resetTime: number;
  message?: string;
}> {
  const limiter = rateLimit(options);
  const result = await limiter(request);

  if (!result.success) {
    return {
      isLimited: true,
      remaining: 0,
      resetTime: result.resetTime || Date.now() + options.windowMs,
      message: options.message
    };
  }

  return {
    isLimited: false,
    remaining: result.remaining || 0,
    resetTime: result.resetTime || Date.now() + options.windowMs
  };
}

/**
 * 手動でレート制限をリセット
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * 全てのレート制限をクリア
 */
export function clearAllRateLimits(): void {
  store.clear();
}

/**
 * レート制限統計を取得
 */
export function getRateLimitStats(): {
  totalKeys: number;
  activeKeys: number;
} {
  return store.getStats();
}

/**
 * 特定IPのレート制限状態を取得
 */
export function getIpRateLimitStatus(ip: string): RateLimitRecord | null {
  return store.get(ip) || null;
}

/**
 * Express.js風のレート制限設定を Next.js 用に変換
 */
export function createExpressStyleLimiter(config: {
  windowMs: number;
  max: number;
  message?: string;
}) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message || 'Too many requests, please try again later.'
  });
}

// 使用例:
// const limiter = rateLimit({
//   windowMs: 60 * 1000, // 1分間
//   max: 5,
//   message: 'アクセス回数が多すぎます。少し待ってください。',
// });
//
// export async function POST(request: NextRequest) {
//   const limitResult = await limiter(request);
//   if (!limitResult.success) {
//     return limitResult.response!;
//   }
//   
//   // 通常の処理
//   return NextResponse.json({ success: true });
// }