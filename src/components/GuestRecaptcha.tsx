'use client';

// ゲストユーザー専用reCAPTCHA v2コンポーネント
// 画像生成前の必須認証として使用

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { isRecaptchaRequired, RECAPTCHA_SITE_KEY } from '@/lib/recaptcha';

interface GuestRecaptchaProps {
  isAuthenticated: boolean;
  onVerify: (token: string | null) => void;
  onError?: (error: string) => void;
  onExpired?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * ゲストユーザー向けreCAPTCHA v2コンポーネント
 * 画像生成前の必須認証
 */
export default function GuestRecaptcha({
  isAuthenticated,
  onVerify,
  onError,
  onExpired,
  disabled = false,
  className = '',
}: GuestRecaptchaProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'error' | 'expired'>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  // reCAPTCHAが必要かどうかを判定
  const needsRecaptcha = isRecaptchaRequired(isAuthenticated);

  /**
   * reCAPTCHA読み込み完了時の処理
   */
  const handleRecaptchaLoad = useCallback(() => {
    setIsLoading(false);
    console.log('✅ reCAPTCHA loaded successfully');
  }, []);

  /**
   * reCAPTCHA認証成功時の処理
   */
  const handleRecaptchaVerify = useCallback((token: string | null) => {
    console.log('🔐 reCAPTCHA verification:', token ? 'SUCCESS' : 'FAILED');
    
    if (token) {
      setVerificationStatus('verified');
      setErrorMessage(null);
      onVerify(token);
    } else {
      setVerificationStatus('error');
      setErrorMessage('reCAPTCHA認証に失敗しました');
      onError?.('reCAPTCHA認証に失敗しました');
    }
  }, [onVerify, onError]);

  /**
   * reCAPTCHA期限切れ時の処理
   */
  const handleRecaptchaExpired = useCallback(() => {
    console.log('⏰ reCAPTCHA expired');
    setVerificationStatus('expired');
    setErrorMessage('reCAPTCHA認証の有効期限が切れました。もう一度認証してください。');
    onExpired?.();
    onVerify(null);
  }, [onExpired, onVerify]);

  /**
   * reCAPTCHA エラー時の処理
   */
  const handleRecaptchaError = useCallback(() => {
    console.error('❌ reCAPTCHA error occurred');
    setVerificationStatus('error');
    setErrorMessage('reCAPTCHA読み込み中にエラーが発生しました。ページを再読み込みしてください。');
    onError?.('reCAPTCHA読み込み中にエラーが発生しました');
  }, [onError]);

  /**
   * reCAPTCHAをリセット
   */
  const resetRecaptcha = useCallback(() => {
    if (recaptchaRef.current) {
      recaptchaRef.current.reset();
      setVerificationStatus('pending');
      setErrorMessage(null);
      onVerify(null);
    }
  }, [onVerify]);

  /**
   * サイトキーの検証
   */
  useEffect(() => {
    if (needsRecaptcha && !RECAPTCHA_SITE_KEY) {
      setErrorMessage('reCAPTCHA設定エラー: サイトキーが設定されていません');
      onError?.('reCAPTCHA設定エラー');
    }
  }, [needsRecaptcha, onError]);

  // 認証済みユーザーの場合は何も表示しない
  if (!needsRecaptcha) {
    return null;
  }

  // サイトキーが設定されていない場合
  if (!RECAPTCHA_SITE_KEY) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <p className="text-red-700 text-sm">
          ⚠️ reCAPTCHA設定エラー: 管理者にお問い合わせください
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* reCAPTCHA説明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs">🛡️</span>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-800">
              スパム防止のため認証が必要です
            </p>
            <p className="text-xs text-blue-600">
              画像生成前にreCAPTCHA認証を完了してください
            </p>
          </div>
        </div>
      </div>

      {/* reCAPTCHA Widget */}
      <div className="flex flex-col items-center space-y-3">
        {isLoading && (
          <div className="flex items-center space-x-2 text-gray-600">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">reCAPTCHA を読み込み中...</span>
          </div>
        )}

        <div className={`transition-opacity duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey={RECAPTCHA_SITE_KEY}
            onChange={handleRecaptchaVerify}
            onExpired={handleRecaptchaExpired}
            onErrored={handleRecaptchaError}
            onLoad={handleRecaptchaLoad}
            size="normal"
            theme="light"
            hl="ja"
          />
        </div>

        {/* 認証状態表示 */}
        <div className="text-center">
          {verificationStatus === 'verified' && (
            <div className="flex items-center space-x-2 text-green-600">
              <span className="text-sm">✅</span>
              <span className="text-sm font-medium">認証完了</span>
            </div>
          )}

          {verificationStatus === 'pending' && !isLoading && (
            <p className="text-xs text-gray-500">
              上記のチェックボックスをクリックして認証を完了してください
            </p>
          )}
        </div>

        {/* エラーメッセージ */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-w-md">
            <p className="text-red-700 text-sm">{errorMessage}</p>
            {(verificationStatus === 'error' || verificationStatus === 'expired') && (
              <button
                onClick={resetRecaptcha}
                disabled={disabled}
                className="mt-2 text-xs text-red-600 hover:text-red-800 underline disabled:opacity-50"
              >
                もう一度認証する
              </button>
            )}
          </div>
        )}

        {/* 操作ボタン */}
        {verificationStatus === 'verified' && (
          <button
            onClick={resetRecaptcha}
            disabled={disabled}
            className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
          >
            認証をリセット
          </button>
        )}
      </div>

      {/* 認証完了後の注意 */}
      {verificationStatus === 'verified' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-green-700 text-sm text-center">
            🎉 認証が完了しました！画像生成ボタンをクリックしてください
          </p>
        </div>
      )}

      {/* プライバシー情報 */}
      <div className="text-xs text-gray-500 text-center space-y-1">
        <p>このサイトはreCAPTCHAによって保護されており、</p>
        <p>
          <a 
            href="https://policies.google.com/privacy" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Googleプライバシーポリシー
          </a>
          と
          <a 
            href="https://policies.google.com/terms" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            利用規約
          </a>
          が適用されます。
        </p>
      </div>
    </div>
  );
}