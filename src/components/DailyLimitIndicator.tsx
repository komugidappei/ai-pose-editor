'use client';

// 日次生成制限の表示・警告コンポーネント
// 1日10回制限の状況をユーザーに分かりやすく表示

import React, { useState, useEffect } from 'react';
import { DailyLimitStatus } from '@/lib/dailyGenerationLimit';

interface DailyLimitIndicatorProps {
  limitStatus?: DailyLimitStatus | null;
  isAuthenticated?: boolean;
  className?: string;
  showDetails?: boolean;
  onRefresh?: () => void;
}

export default function DailyLimitIndicator({
  limitStatus,
  isAuthenticated = false,
  className = '',
  showDetails = true,
  onRefresh
}: DailyLimitIndicatorProps) {
  const [timeUntilReset, setTimeUntilReset] = useState<string>('');

  // リセット時刻までの残り時間を計算
  useEffect(() => {
    if (!limitStatus?.resetTime) return;

    const updateTimeUntilReset = () => {
      const resetTime = new Date(limitStatus.resetTime);
      const now = new Date();
      const diff = resetTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntilReset('リセット済み');
        // リセット時刻を過ぎた場合は自動更新を促す
        if (onRefresh) {
          setTimeout(onRefresh, 1000);
        }
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeUntilReset(`${hours}時間${minutes}分後`);
    };

    updateTimeUntilReset();
    const interval = setInterval(updateTimeUntilReset, 60000); // 1分ごとに更新

    return () => clearInterval(interval);
  }, [limitStatus?.resetTime, onRefresh]);

  // 制限状況が取得できていない場合
  if (!limitStatus) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600 text-sm">制限状況を確認中...</span>
        </div>
      </div>
    );
  }

  // 制限レベルに応じた色とアイコン
  const getLimitLevelStyle = () => {
    const remaining = limitStatus.remaining;
    const percentage = (remaining / limitStatus.limit) * 100;

    if (!limitStatus.canGenerate) {
      return {
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        iconColor: 'text-red-600',
        icon: '🚫',
        urgency: 'critical'
      };
    } else if (percentage <= 20) {
      return {
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        textColor: 'text-orange-800',
        iconColor: 'text-orange-600',
        icon: '⚠️',
        urgency: 'warning'
      };
    } else if (percentage <= 50) {
      return {
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        iconColor: 'text-yellow-600',
        icon: '⚡',
        urgency: 'caution'
      };
    } else {
      return {
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-800',
        iconColor: 'text-green-600',
        icon: '✅',
        urgency: 'healthy'
      };
    }
  };

  const style = getLimitLevelStyle();

  // プログレスバーの計算
  const progressPercentage = Math.max(0, (limitStatus.currentCount / limitStatus.limit) * 100);

  return (
    <div className={`${style.bgColor} ${style.borderColor} border rounded-lg p-4 ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{style.icon}</span>
          <h3 className={`font-semibold ${style.textColor}`}>
            日次生成制限
          </h3>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className={`${style.iconColor} hover:opacity-70 transition-opacity`}
            title="更新"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>

      {/* メイン情報 */}
      <div className="space-y-3">
        {/* 制限状況メッセージ */}
        <div className={`${style.textColor}`}>
          {!limitStatus.canGenerate ? (
            <p className="font-medium">
              本日の生成制限（{limitStatus.limit}回）に達しています
            </p>
          ) : (
            <p>
              残り <span className="font-semibold">{limitStatus.remaining}回</span> / {limitStatus.limit}回
            </p>
          )}
        </div>

        {/* プログレスバー */}
        <div className="relative">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                style.urgency === 'critical' ? 'bg-red-500' :
                style.urgency === 'warning' ? 'bg-orange-500' :
                style.urgency === 'caution' ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, progressPercentage)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1 text-gray-600">
            <span>0</span>
            <span>{limitStatus.currentCount}</span>
            <span>{limitStatus.limit}</span>
          </div>
        </div>

        {/* 詳細情報 */}
        {showDetails && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">今日の使用回数:</span>
              <span className={`ml-2 font-medium ${style.textColor}`}>
                {limitStatus.currentCount}回
              </span>
            </div>
            <div>
              <span className="text-gray-600">ユーザー種別:</span>
              <span className="ml-2 font-medium">
                {limitStatus.isGuest ? '🌐 ゲスト' : '👤 認証済み'}
              </span>
            </div>
            {timeUntilReset && (
              <div className="md:col-span-2">
                <span className="text-gray-600">リセット:</span>
                <span className="ml-2 font-medium">
                  {timeUntilReset}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 制限超過時の案内 */}
        {!limitStatus.canGenerate && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-md">
            <h4 className="text-red-800 font-medium mb-2">制限に達しています</h4>
            <ul className="text-red-700 text-sm space-y-1">
              <li>• 制限は明日の午前2時にリセットされます</li>
              <li>• より多くの生成を行うには、アカウントを作成してください</li>
              <li>• プレミアムプランでは制限が大幅に緩和されます</li>
            </ul>
          </div>
        )}

        {/* 警告メッセージ */}
        {limitStatus.canGenerate && limitStatus.remaining <= 2 && (
          <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded-md">
            <p className="text-orange-800 text-sm">
              ⚠️ 残り{limitStatus.remaining}回です。計画的にご利用ください。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * コンパクト版の制限表示（ボタン横などに配置）
 */
export function CompactDailyLimitIndicator({
  limitStatus,
  className = ''
}: {
  limitStatus?: DailyLimitStatus | null;
  className?: string;
}) {
  if (!limitStatus) {
    return (
      <div className={`flex items-center space-x-1 text-gray-500 text-xs ${className}`}>
        <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        <span>制限確認中</span>
      </div>
    );
  }

  const getCompactStyle = () => {
    if (!limitStatus.canGenerate) {
      return { color: 'text-red-600', icon: '🚫' };
    } else if (limitStatus.remaining <= 2) {
      return { color: 'text-orange-600', icon: '⚠️' };
    } else {
      return { color: 'text-green-600', icon: '✅' };
    }
  };

  const style = getCompactStyle();

  return (
    <div className={`flex items-center space-x-1 text-xs ${style.color} ${className}`}>
      <span>{style.icon}</span>
      <span>
        {limitStatus.canGenerate 
          ? `残り${limitStatus.remaining}回`
          : '制限到達'
        }
      </span>
    </div>
  );
}

/**
 * アラート用のモーダル表示
 */
export function DailyLimitAlert({
  limitStatus,
  isOpen,
  onClose,
  onUpgrade
}: {
  limitStatus: DailyLimitStatus;
  isOpen: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            生成制限に達しました
          </h2>
          <p className="text-gray-600 mb-4">
            本日の画像生成制限（{limitStatus.limit}回）に達しています。
            制限は明日の午前2時にリセットされます。
          </p>
          
          <div className="space-y-3">
            {onUpgrade && (
              <button
                onClick={onUpgrade}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                プレミアムプランにアップグレード
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}