'use client';

import { useState, useRef, useCallback } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { RECAPTCHA_SITE_KEY, isRecaptchaRequired } from '@/lib/recaptcha';

interface RecaptchaWrapperProps {
  onVerify: (token: string | null) => void;
  onExpired?: () => void;
  onError?: (error: any) => void;
  isAuthenticated?: boolean;
  disabled?: boolean;
  size?: 'compact' | 'normal';
  theme?: 'light' | 'dark';
  className?: string;
}

export default function RecaptchaWrapper({
  onVerify,
  onExpired,
  onError,
  isAuthenticated = false,
  disabled = false,
  size = 'normal',
  theme = 'light',
  className = ''
}: RecaptchaWrapperProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  // reCAPTCHAが必要かどうかを判定
  const recaptchaRequired = isRecaptchaRequired(isAuthenticated);

  // reCAPTCHA検証完了時の処理
  const handleVerify = useCallback((token: string | null) => {
    setIsLoading(false);
    setError(null);
    onVerify(token);
  }, [onVerify]);

  // reCAPTCHA期限切れ時の処理
  const handleExpired = useCallback(() => {
    setError('reCAPTCHA認証の有効期限が切れました。再度認証してください。');
    onExpired?.();
  }, [onExpired]);

  // reCAPTCHAエラー時の処理
  const handleError = useCallback((error: any) => {
    setIsLoading(false);
    setError('reCAPTCHA認証中にエラーが発生しました。ページを再読み込みしてください。');
    console.error('reCAPTCHA error:', error);
    onError?.(error);
  }, [onError]);

  // reCAPTCHAリセット
  const resetRecaptcha = useCallback(() => {
    if (recaptchaRef.current) {
      recaptchaRef.current.reset();
      setError(null);
      setIsLoading(false);
    }
  }, []);

  // reCAPTCHA実行
  const executeRecaptcha = useCallback(async (): Promise<string | null> => {
    if (!recaptchaRequired) {
      return null; // 認証済みユーザーはreCAPTCHA不要
    }

    if (!recaptchaRef.current) {
      throw new Error('reCAPTCHAが初期化されていません');
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await recaptchaRef.current.executeAsync();
      setIsLoading(false);
      return token;
    } catch (error) {
      setIsLoading(false);
      const errorMessage = 'reCAPTCHA認証に失敗しました';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [recaptchaRequired]);

  // reCAPTCHA設定の検証
  if (!RECAPTCHA_SITE_KEY) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600 text-sm">
          ⚠️ reCAPTCHA設定エラー: サイトキーが設定されていません
        </p>
      </div>
    );
  }

  // 認証済みユーザーの場合はreCAPTCHA表示不要
  if (!recaptchaRequired) {
    return (
      <div className="text-green-600 text-sm flex items-center space-x-2">
        <span>✅</span>
        <span>ログイン済みのため、reCAPTCHA認証は不要です</span>
      </div>
    );
  }

  return (
    <div className={`recaptcha-wrapper ${className}`}>
      {/* reCAPTCHA本体 */}
      <div className="flex flex-col space-y-2">
        <ReCAPTCHA
          ref={recaptchaRef}
          sitekey={RECAPTCHA_SITE_KEY}
          onChange={handleVerify}
          onExpired={handleExpired}
          onError={handleError}
          size={size}
          theme={theme}
          disabled={disabled || isLoading}
        />

        {/* 読み込み状態表示 */}
        {isLoading && (
          <div className="flex items-center space-x-2 text-blue-600 text-sm">
            <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>認証中...</span>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={resetRecaptcha}
              className="mt-2 text-blue-600 text-sm hover:text-blue-800 transition-colors"
            >
              再試行
            </button>
          </div>
        )}

        {/* 使用方法の説明 */}
        <div className="text-gray-500 text-xs">
          <p>スパム防止のため、reCAPTCHA認証を行っています。</p>
          <p>「私はロボットではありません」にチェックを入れてください。</p>
        </div>
      </div>
    </div>
  );
}

// reCAPTCHAプロバイダーコンポーネント
interface RecaptchaProviderProps {
  children: React.ReactNode;
}

export function RecaptchaProvider({ children }: RecaptchaProviderProps) {
  return (
    <>
      {/* reCAPTCHA v2 スクリプトの読み込み */}
      <script
        src={`https://www.google.com/recaptcha/api.js?render=explicit&hl=ja`}
        async
        defer
      />
      {children}
    </>
  );
}

// reCAPTCHA検証用フック
export function useRecaptchaVerification() {
  const [isVerified, setIsVerified] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = useCallback((recaptchaToken: string | null) => {
    if (recaptchaToken) {
      setToken(recaptchaToken);
      setIsVerified(true);
      setError(null);
    } else {
      setToken(null);
      setIsVerified(false);
      setError('reCAPTCHA認証に失敗しました');
    }
  }, []);

  const handleExpired = useCallback(() => {
    setToken(null);
    setIsVerified(false);
    setError('reCAPTCHA認証の有効期限が切れました');
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    setIsVerified(false);
    setError(null);
  }, []);

  return {
    isVerified,
    token,
    error,
    handleVerify,
    handleExpired,
    reset
  };
}