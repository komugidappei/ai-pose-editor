'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SafeError } from '@/components/SafeText';

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const descriptionParam = searchParams.get('description');
    
    setError(errorParam);
    setDescription(descriptionParam);
  }, [searchParams]);

  const getErrorMessage = (errorCode: string | null): string => {
    switch (errorCode) {
      case 'access_denied':
        return 'ログインがキャンセルされました';
      case 'invalid_request':
        return '不正なリクエストです';
      case 'server_error':
        return 'サーバーエラーが発生しました';
      case 'temporarily_unavailable':
        return 'サービスが一時的に利用できません';
      case 'callback_error':
        return '認証処理中にエラーが発生しました';
      default:
        return '認証エラーが発生しました';
    }
  };

  const getErrorIcon = (errorCode: string | null): string => {
    switch (errorCode) {
      case 'access_denied':
        return '🚫';
      case 'server_error':
        return '⚠️';
      case 'temporarily_unavailable':
        return '⏳';
      default:
        return '❌';
    }
  };

  const handleRetry = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* エラーアイコン */}
          <div className="flex justify-center mb-6">
            <div className="text-6xl">
              {getErrorIcon(error)}
            </div>
          </div>

          {/* エラータイトル */}
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              ログインに失敗しました
            </h2>
            
            {/* エラーメッセージ */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800 font-medium mb-2">
                {getErrorMessage(error)}
              </p>
              
              {description && (
                <p className="text-red-600 text-sm">
                  詳細: <SafeError>{description}</SafeError>
                </p>
              )}
            </div>

            {/* エラーコード（開発時のみ表示） */}
            {process.env.NODE_ENV === 'development' && error && (
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 mb-6">
                <p className="text-gray-600 text-xs">
                  エラーコード: <SafeError>{error}</SafeError>
                </p>
              </div>
            )}

            {/* 対処法 */}
            <div className="text-left mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">対処法:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• ブラウザの設定でポップアップブロックが有効になっていないか確認してください</li>
                <li>• 一時的な問題の可能性があります。しばらく待ってから再試行してください</li>
                <li>• 問題が続く場合は、別のログイン方法をお試しください</li>
              </ul>
            </div>

            {/* アクションボタン */}
            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                トップページに戻る
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                再試行
              </button>
            </div>

            {/* サポート情報 */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                問題が解決しない場合は、お使いのブラウザの設定を確認するか、
                サポートまでお問い合わせください。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}