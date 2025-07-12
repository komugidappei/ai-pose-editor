'use client';

// 保存画像制限と自動削除の通知コンポーネント

import React from 'react';

interface ImageLimitNotificationProps {
  currentCount: number;
  limit: number;
  deletedOldImages?: number;
  planName?: string;
  className?: string;
}

export default function ImageLimitNotification({
  currentCount,
  limit,
  deletedOldImages = 0,
  planName = 'free',
  className = '',
}: ImageLimitNotificationProps) {
  const usagePercentage = limit === -1 ? 0 : (currentCount / limit) * 100;
  const remainingSlots = limit === -1 ? -1 : Math.max(0, limit - currentCount);

  // 使用率に基づく警告レベル
  const getWarningLevel = (): 'safe' | 'warning' | 'danger' | 'unlimited' => {
    if (limit === -1) return 'unlimited';
    if (usagePercentage >= 100) return 'danger';
    if (usagePercentage >= 80) return 'warning';
    return 'safe';
  };

  const warningLevel = getWarningLevel();

  // スタイルの決定
  const getStyles = () => {
    switch (warningLevel) {
      case 'unlimited':
        return {
          container: 'bg-purple-50 border-purple-200',
          icon: '♾️',
          iconColor: 'text-purple-600',
          text: 'text-purple-800',
          progressBar: 'bg-purple-500',
        };
      case 'safe':
        return {
          container: 'bg-green-50 border-green-200',
          icon: '✅',
          iconColor: 'text-green-600',
          text: 'text-green-800',
          progressBar: 'bg-green-500',
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-200',
          icon: '⚠️',
          iconColor: 'text-yellow-600',
          text: 'text-yellow-800',
          progressBar: 'bg-yellow-500',
        };
      case 'danger':
        return {
          container: 'bg-red-50 border-red-200',
          icon: '🚨',
          iconColor: 'text-red-600',
          text: 'text-red-800',
          progressBar: 'bg-red-500',
        };
    }
  };

  const styles = getStyles();

  return (
    <div className={`border rounded-lg p-4 ${styles.container} ${className}`}>
      {/* 自動削除通知 */}
      {deletedOldImages > 0 && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-blue-600">🗑️</span>
            <div>
              <p className="text-blue-800 font-medium text-sm">
                古い画像を自動削除しました
              </p>
              <p className="text-blue-700 text-xs">
                保存制限に達していたため、古い画像{deletedOldImages}枚を自動的に削除し、新しい画像を保存しました。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 保存制限の状態表示 */}
      <div className="flex items-start space-x-3">
        <span className={`text-lg ${styles.iconColor}`}>{styles.icon}</span>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className={`font-semibold ${styles.text}`}>
              保存画像制限
            </h4>
            <span className={`text-sm font-medium ${styles.text}`}>
              {limit === -1 ? (
                '無制限'
              ) : (
                `${currentCount} / ${limit} 枚`
              )}
            </span>
          </div>

          {/* プログレスバー */}
          {limit !== -1 && (
            <div className="mb-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${styles.progressBar}`}
                  style={{
                    width: `${Math.min(100, usagePercentage)}%`
                  }}
                ></div>
              </div>
            </div>
          )}

          {/* 詳細情報 */}
          <div className={`text-sm ${styles.text}`}>
            {limit === -1 ? (
              <div className="space-y-1">
                <p>🎉 Proプランで画像保存数は無制限です</p>
                <p className="text-purple-700">現在 {currentCount} 枚の画像を保存中</p>
              </div>
            ) : (
              <div className="space-y-1">
                {warningLevel === 'safe' && (
                  <>
                    <p>✨ 画像を保存できます</p>
                    {remainingSlots > 0 && (
                      <p>あと {remainingSlots} 枚まで保存可能</p>
                    )}
                  </>
                )}
                
                {warningLevel === 'warning' && (
                  <>
                    <p>⚠️ 保存制限に近づいています</p>
                    <p>あと {remainingSlots} 枚で制限に達します</p>
                    <p className="text-yellow-700">
                      制限に達すると、新しい画像保存時に古い画像が自動削除されます
                    </p>
                  </>
                )}
                
                {warningLevel === 'danger' && (
                  <>
                    <p>🚨 保存制限に達しています</p>
                    <p className="font-medium">
                      新しい画像を保存すると、最も古い画像が自動的に削除されます
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* プラン情報とアップグレード案内 */}
          {planName === 'free' && limit !== -1 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-600 mb-1">
                現在のプラン: <span className="font-medium">Free ({limit}枚まで)</span>
              </p>
              {warningLevel !== 'safe' && (
                <p className="text-xs text-blue-600">
                  💡 <a href="/pricing" className="underline hover:text-blue-800">
                    Premiumプラン（100枚）またはProプラン（無制限）
                  </a>にアップグレードして制限を増やせます
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}