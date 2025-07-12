// Next.js ミドルウェア - レート制限とセキュリティ強化
// API全体にレート制限を適用

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitPresets } from '@/lib/rateLimit';
import { setSecurityHeaders, enforceHTTPS } from '@/lib/securityHeaders';

// グローバルレート制限設定
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分間
  max: 20, // 全APIで1分間に20回まで
  message: 'アクセス回数が多すぎます。少し待ってからもう一度お試しください。'
});

// エンドポイント別レート制限設定
const endpointLimiters: Record<string, ReturnType<typeof rateLimit>> = {
  '/api/generate': rateLimit(rateLimitPresets.imageGeneration),
  '/api/generate-secure': rateLimit(rateLimitPresets.imageGeneration),
  '/api/pose': rateLimit(rateLimitPresets.upload),
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. HTTPS強制チェック（本番環境のみ）
  const httpsRedirect = enforceHTTPS(request);
  if (httpsRedirect) {
    return httpsRedirect;
  }

  // 2. セキュリティヘッダーを含むレスポンスを準備
  let response = NextResponse.next();

  // 3. API エンドポイントのレート制限チェック
  if (pathname.startsWith('/api/')) {
    // OPTIONSリクエストはスキップ（プリフライトリクエスト）
    if (request.method === 'OPTIONS') {
      return setSecurityHeaders(response);
    }

    try {
      // 4. グローバルレート制限チェック
      const globalResult = await globalLimiter(request);
      if (!globalResult.success && globalResult.response) {
        return setSecurityHeaders(globalResult.response);
      }

      // 5. エンドポイント固有のレート制限チェック
      const specificLimiter = endpointLimiters[pathname];
      if (specificLimiter) {
        const specificResult = await specificLimiter(request);
        if (!specificResult.success && specificResult.response) {
          return setSecurityHeaders(specificResult.response);
        }

        // レスポンスにレート制限ヘッダーを追加
        if (specificResult.remaining !== undefined) {
          response.headers.set('X-RateLimit-Remaining', specificResult.remaining.toString());
        }
        if (specificResult.resetTime) {
          response.headers.set('X-RateLimit-Reset', specificResult.resetTime.toString());
        }
      }

      // グローバルレート制限ヘッダー
      if (globalResult.remaining !== undefined) {
        response.headers.set('X-Global-RateLimit-Remaining', globalResult.remaining.toString());
      }

    } catch (error) {
      console.error('ミドルウェアエラー:', error);
      // エラー時もセキュリティヘッダーを適用
    }
  }

  // 6. すべてのレスポンスにセキュリティヘッダーを適用
  return setSecurityHeaders(response);
}

// ミドルウェアを適用するパス
export const config = {
  matcher: [
    // API routes
    '/api/(.*)',
    // 除外パス（静的ファイルなど）を指定
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};