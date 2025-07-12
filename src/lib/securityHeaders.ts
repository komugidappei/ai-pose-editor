// セキュリティヘッダー設定
// CSP、HTTPS強制、その他のセキュリティヘッダー

import { NextRequest, NextResponse } from 'next/server';

// 環境判定
const isDev = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// 厳格なCSP設定（あなたのアプローチに基づく）
export const CSP_POLICY = {
  // 基本ポリシー - 最も制限的
  'default-src': ["'self'"],
  
  // 画像 - data: URLのみ許可（Base64画像用）
  'img-src': [
    "'self'",
    'data:' // Base64画像のみ
  ],
  
  // スクリプト - 自ドメインのみ（最も安全）
  'script-src': [
    "'self'",
    ...(isDev ? ["'unsafe-eval'"] : []) // 開発時のみHMR用
  ],
  
  // スタイル - インラインCSS最小限
  'style-src': [
    "'self'",
    "'unsafe-inline'" // TailwindCSS用（最小限）
  ],
  
  // フォント - 自ドメインのみ
  'font-src': ["'self'"],
  
  // 接続先 - 自ドメインのみ
  'connect-src': [
    "'self'",
    ...(isDev ? ['ws://localhost:*', 'wss://localhost:*'] : []) // 開発時のみWebSocket
  ],
  
  // フレーム - 完全禁止
  'frame-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  
  // その他 - 最大限制限
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': isProduction ? [] : undefined
};

// 外部サービス使用時の緩和版CSP（必要に応じて使用）
export const CSP_POLICY_WITH_EXTERNAL = {
  'default-src': ["'self'"],
  
  'img-src': [
    "'self'",
    'data:',
    // 必要最小限の外部画像ソース
    'https://*.supabase.co', // Supabase Storage（必要な場合のみ）
  ],
  
  'script-src': [
    "'self'",
    // 必要最小限の外部スクリプト
    'https://www.google.com', // reCAPTCHA（必要な場合のみ）
    'https://www.gstatic.com',
    ...(isDev ? ["'unsafe-eval'"] : [])
  ],
  
  'style-src': [
    "'self'",
    "'unsafe-inline'"
  ],
  
  'connect-src': [
    "'self'",
    // 必要最小限のAPI接続
    'https://*.supabase.co', // Supabase（必要な場合のみ）
    ...(isDev ? ['ws://localhost:*'] : [])
  ],
  
  'frame-src': [
    'https://www.google.com' // reCAPTCHA（必要な場合のみ）
  ],
  
  'frame-ancestors': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': isProduction ? [] : undefined
};

/**
 * CSPポリシーを選択（環境変数で制御）
 */
function getCSPPolicy() {
  const useExternal = process.env.CSP_ALLOW_EXTERNAL === 'true';
  return useExternal ? CSP_POLICY_WITH_EXTERNAL : CSP_POLICY;
}

/**
 * CSPポリシー文字列を生成
 */
export function generateCSPString(): string {
  const policy = getCSPPolicy();
  
  return Object.entries(policy)
    .filter(([_, value]) => value !== undefined)
    .map(([directive, sources]) => {
      if (Array.isArray(sources)) {
        return `${directive} ${sources.join(' ')}`;
      }
      return `${directive}`;
    })
    .join('; ');
}

/**
 * 厳格なCSP文字列を生成（あなたの例に基づく）
 */
export function generateStrictCSPString(): string {
  return "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';";
}

/**
 * セキュリティヘッダーを設定
 */
export function setSecurityHeaders(response: NextResponse): NextResponse {
  // CSP
  response.headers.set('Content-Security-Policy', generateCSPString());
  
  // HTTPS強制（本番環境のみ）
  if (isProduction) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // XSS Protection
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  response.headers.set('Permissions-Policy', [
    'camera=()', 
    'microphone=()', 
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'accelerometer=()',
    'gyroscope=()'
  ].join(', '));
  
  // COEP/COOP（必要に応じて）
  if (isProduction) {
    response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  }
  
  return response;
}

/**
 * HTTPS強制チェック
 */
export function enforceHTTPS(request: NextRequest): NextResponse | null {
  // 本番環境でHTTPSでない場合はリダイレクト
  if (isProduction) {
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    
    if (protocol !== 'https' && host) {
      const httpsUrl = `https://${host}${request.nextUrl.pathname}${request.nextUrl.search}`;
      return NextResponse.redirect(httpsUrl, 301);
    }
  }
  
  return null;
}

/**
 * セキュリティヘッダー確認用の情報
 */
export function getSecurityInfo(): {
  environment: string;
  httpsEnforced: boolean;
  cspEnabled: boolean;
  headers: Record<string, string>;
} {
  return {
    environment: process.env.NODE_ENV || 'unknown',
    httpsEnforced: isProduction,
    cspEnabled: true,
    headers: {
      'Content-Security-Policy': generateCSPString(),
      'Strict-Transport-Security': isProduction ? 'max-age=31536000; includeSubDomains; preload' : 'disabled',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  };
}