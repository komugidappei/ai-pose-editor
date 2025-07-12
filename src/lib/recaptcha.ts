// Google reCAPTCHA v2 の実装
// ゲストユーザーの画像生成・アップロード時のスパム対策

import { createContext, useContext } from 'react';

// reCAPTCHA設定
export const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';
export const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '';

// reCAPTCHA検証結果の型定義
export interface RecaptchaVerificationResult {
  success: boolean;
  error?: string;
  score?: number; // v3用（v2では使用しない）
  challenge_ts?: string;
  hostname?: string;
}

// reCAPTCHAコンテキストの型定義
export interface RecaptchaContextType {
  isLoaded: boolean;
  executeRecaptcha: () => Promise<string | null>;
  resetRecaptcha: () => void;
}

// reCAPTCHAコンテキスト
export const RecaptchaContext = createContext<RecaptchaContextType | null>(null);

/**
 * reCAPTCHAコンテキストを使用するフック
 */
export function useRecaptcha(): RecaptchaContextType {
  const context = useContext(RecaptchaContext);
  if (!context) {
    throw new Error('useRecaptcha must be used within a RecaptchaProvider');
  }
  return context;
}

/**
 * サーバーサイドでreCAPTCHAトークンを検証
 */
export async function verifyRecaptchaToken(token: string, remoteIp?: string): Promise<RecaptchaVerificationResult> {
  try {
    if (!RECAPTCHA_SECRET_KEY) {
      console.error('RECAPTCHA_SECRET_KEY が設定されていません');
      return {
        success: false,
        error: 'reCAPTCHA設定エラー'
      };
    }

    if (!token) {
      return {
        success: false,
        error: 'reCAPTCHAトークンが提供されていません'
      };
    }

    // Google reCAPTCHA API に検証リクエストを送信
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const params = new URLSearchParams({
      secret: RECAPTCHA_SECRET_KEY,
      response: token,
    });

    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`reCAPTCHA検証リクエストに失敗: ${response.status}`);
    }

    const result = await response.json();

    // Google API からの応答をログ出力（デバッグ用）
    console.log('reCAPTCHA verification result:', {
      success: result.success,
      challenge_ts: result.challenge_ts,
      hostname: result.hostname,
      'error-codes': result['error-codes']
    });

    if (!result.success) {
      const errorCodes = result['error-codes'] || [];
      const errorMessages = errorCodes.map((code: string) => getErrorMessage(code));
      
      return {
        success: false,
        error: `reCAPTCHA検証に失敗しました: ${errorMessages.join(', ')}`,
      };
    }

    return {
      success: true,
      challenge_ts: result.challenge_ts,
      hostname: result.hostname,
    };

  } catch (error) {
    console.error('reCAPTCHA検証エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'reCAPTCHA検証中に予期しないエラーが発生しました'
    };
  }
}

/**
 * reCAPTCHAエラーコードを日本語メッセージに変換
 */
function getErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    'missing-input-secret': 'シークレットキーが不足しています',
    'invalid-input-secret': 'シークレットキーが無効です',
    'missing-input-response': 'reCAPTCHAレスポンスが不足しています',
    'invalid-input-response': 'reCAPTCHAレスポンスが無効です',
    'bad-request': '不正なリクエストです',
    'timeout-or-duplicate': 'タイムアウトまたは重複リクエストです'
  };

  return errorMessages[errorCode] || `不明なエラー: ${errorCode}`;
}

/**
 * クライアントサイドでreCAPTCHAが必要かどうかを判定
 */
export function isRecaptchaRequired(isAuthenticated: boolean): boolean {
  // ゲストユーザー（未認証）の場合のみreCAPTCHAが必要
  return !isAuthenticated;
}

/**
 * 画像生成専用のreCAPTCHA検証（ゲストユーザー必須）
 */
export async function verifyImageGenerationRecaptcha(
  token: string | null,
  isAuthenticated: boolean,
  remoteIp?: string
): Promise<{ success: boolean; error?: string; bypassReason?: string }> {
  // 認証済みユーザーはreCAPTCHAを免除
  if (isAuthenticated) {
    return {
      success: true,
      bypassReason: 'authenticated_user'
    };
  }

  // ゲストユーザーはreCAPTCHA必須
  if (!token) {
    return {
      success: false,
      error: '画像生成にはreCAPTCHA認証が必要です。認証を完了してから再度お試しください。'
    };
  }

  // reCAPTCHAトークンを検証
  const result = await verifyRecaptchaToken(token, remoteIp);
  
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'reCAPTCHA認証に失敗しました。もう一度お試しください。'
    };
  }

  return { success: true };
}

/**
 * Next.js API RouteでreCAPTCHA検証を行うヘルパー
 */
export async function validateRecaptchaMiddleware(
  request: Request,
  options?: {
    skipForAuthenticatedUsers?: boolean;
    customErrorMessage?: string;
  }
): Promise<{ isValid: boolean; error?: string; userId?: string }> {
  try {
    // リクエストボディからreCAPTCHAトークンを取得
    const body = await request.clone().json();
    const recaptchaToken = body.recaptchaToken;

    // 認証されたユーザーの場合はreCAPTCHAをスキップ
    if (options?.skipForAuthenticatedUsers) {
      // ここでユーザー認証状態をチェック
      // 実装例: JWTトークンや認証ヘッダーの確認
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        // 認証済みユーザーの場合はreCAPTCHAスキップ
        return { isValid: true, userId: 'authenticated-user' };
      }
    }

    // reCAPTCHAトークンが提供されていない場合
    if (!recaptchaToken) {
      return {
        isValid: false,
        error: options?.customErrorMessage || 'reCAPTCHA認証が必要です'
      };
    }

    // reCAPTCHAトークンを検証
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    const verificationResult = await verifyRecaptchaToken(recaptchaToken, clientIp);

    if (!verificationResult.success) {
      return {
        isValid: false,
        error: verificationResult.error || 'reCAPTCHA認証に失敗しました'
      };
    }

    return { isValid: true };

  } catch (error) {
    console.error('reCAPTCHA middleware error:', error);
    return {
      isValid: false,
      error: 'reCAPTCHA認証中にエラーが発生しました'
    };
  }
}

/**
 * reCAPTCHA設定の検証
 */
export function validateRecaptchaConfig(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!RECAPTCHA_SITE_KEY) {
    errors.push('NEXT_PUBLIC_RECAPTCHA_SITE_KEY が設定されていません');
  }

  if (!RECAPTCHA_SECRET_KEY) {
    errors.push('RECAPTCHA_SECRET_KEY が設定されていません');
  }

  // Site Keyの形式チェック（Google reCAPTCHAのキー形式）
  if (RECAPTCHA_SITE_KEY && !RECAPTCHA_SITE_KEY.match(/^6[0-9A-Za-z_-]{39}$/)) {
    errors.push('RECAPTCHA_SITE_KEY の形式が正しくありません');
  }

  // Secret Keyの形式チェック
  if (RECAPTCHA_SECRET_KEY && !RECAPTCHA_SECRET_KEY.match(/^6[0-9A-Za-z_-]{39}$/)) {
    errors.push('RECAPTCHA_SECRET_KEY の形式が正しくありません');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * reCAPTCHA読み込み状態の管理用フック
 */
export function useRecaptchaLoad(): {
  isLoaded: boolean;
  loadError: string | null;
} {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // reCAPTCHA設定の検証
    const config = validateRecaptchaConfig();
    if (!config.isValid) {
      setLoadError(`reCAPTCHA設定エラー: ${config.errors.join(', ')}`);
      return;
    }

    // グローバルなreCAPTCHA読み込み状態をチェック
    if (typeof window !== 'undefined' && window.grecaptcha) {
      setIsLoaded(true);
    } else {
      // reCAPTCHAスクリプトの読み込み完了を待機
      const checkRecaptcha = () => {
        if (window.grecaptcha) {
          setIsLoaded(true);
        } else {
          setTimeout(checkRecaptcha, 100);
        }
      };
      checkRecaptcha();
    }
  }, []);

  return { isLoaded, loadError };
}

// useState, useEffectのインポートが必要
import { useState, useEffect } from 'react';