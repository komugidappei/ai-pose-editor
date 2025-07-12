'use client';

// ウォーターマークプレビューコンポーネント
// ユーザーにウォーターマークの表示例を提供

import React, { useState, useEffect } from 'react';
import { 
  generateWatermarkPreview, 
  WATERMARK_CONFIG, 
  shouldAddWatermark,
  formatWatermarkInfo,
  type WatermarkSettings 
} from '@/lib/watermark';

interface WatermarkPreviewProps {
  userId?: string;
  isCommercial?: boolean;
  className?: string;
  showSettings?: boolean;
}

export default function WatermarkPreview({
  userId = 'guest',
  isCommercial = false,
  className = '',
  showSettings = false
}: WatermarkPreviewProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<WatermarkSettings | null>(null);

  // ウォーターマーク情報を取得
  const watermarkInfo = formatWatermarkInfo(userId, isCommercial);
  const needsWatermark = shouldAddWatermark(userId, isCommercial);

  // プレビュー画像を生成
  useEffect(() => {
    const generatePreview = async () => {
      setLoading(true);
      
      if (!needsWatermark) {
        setPreviewImage(null);
        setSettings(null);
        setLoading(false);
        return;
      }

      const watermarkSettings = WATERMARK_CONFIG.free;
      if (!watermarkSettings) {
        setLoading(false);
        return;
      }

      setSettings(watermarkSettings);

      try {
        const preview = await generateWatermarkPreview(watermarkSettings, {
          width: 400,
          height: 300
        });
        setPreviewImage(preview);
      } catch (error) {
        console.error('ウォーターマークプレビュー生成エラー:', error);
        setPreviewImage(null);
      } finally {
        setLoading(false);
      }
    };

    generatePreview();
  }, [needsWatermark, userId, isCommercial]);

  // ウォーターマークが不要な場合
  if (!needsWatermark) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <span className="text-green-600 text-xl">✅</span>
          <div>
            <h3 className="font-semibold text-green-900">ウォーターマークなし</h3>
            <p className="text-green-700 text-sm">
              {isCommercial 
                ? '商用利用のため、ウォーターマークは追加されません。' 
                : 'プレミアムユーザーのため、ウォーターマークは追加されません。'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-yellow-600 text-xl">⚠️</span>
        <h3 className="font-semibold text-gray-900">ウォーターマークプレビュー</h3>
      </div>

      {/* プレビュー画像 */}
      <div className="mb-4">
        {loading ? (
          <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-gray-600 text-sm">プレビュー生成中...</span>
            </div>
          </div>
        ) : previewImage ? (
          <div className="relative">
            <img 
              src={previewImage} 
              alt="ウォーターマークプレビュー"
              className="w-full max-w-md mx-auto rounded-lg border border-gray-300"
            />
            <div className="text-center mt-2">
              <span className="text-xs text-gray-500">
                実際の画像では右下に「{watermarkInfo.watermarkText}」が表示されます
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
            <span className="text-gray-500">プレビューの生成に失敗しました</span>
          </div>
        )}
      </div>

      {/* ウォーターマーク情報 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <h4 className="font-medium text-yellow-900 mb-2">📝 ウォーターマーク詳細</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-yellow-700">テキスト:</span>
            <span className="font-medium text-yellow-900">{watermarkInfo.watermarkText}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-yellow-700">位置:</span>
            <span className="font-medium text-yellow-900">右下</span>
          </div>
          <div className="flex justify-between">
            <span className="text-yellow-700">透明度:</span>
            <span className="font-medium text-yellow-900">{settings ? `${Math.round(settings.opacity * 100)}%` : '80%'}</span>
          </div>
        </div>
        
        {watermarkInfo.upgradeMessage && (
          <div className="mt-3 pt-3 border-t border-yellow-300">
            <p className="text-yellow-800 text-sm">
              💡 {watermarkInfo.upgradeMessage}
            </p>
          </div>
        )}
      </div>

      {/* 設定詳細（オプション） */}
      {showSettings && settings && (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <h4 className="font-medium text-gray-900 mb-2">⚙️ 技術詳細</h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div>フォントサイズ: {settings.fontSize}px</div>
            <div>パディング: {settings.padding}px</div>
            <div>マージン: {settings.margin}px</div>
            <div>背景色: {settings.backgroundColor}</div>
            <div>文字色: {settings.color}</div>
            <div>位置: {settings.position}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 簡易版ウォーターマーク表示
 */
export function WatermarkIndicator({ 
  userId = 'guest', 
  isCommercial = false,
  className = '' 
}: {
  userId?: string;
  isCommercial?: boolean;
  className?: string;
}) {
  const needsWatermark = shouldAddWatermark(userId, isCommercial);
  const watermarkInfo = formatWatermarkInfo(userId, isCommercial);

  if (!needsWatermark) {
    return (
      <div className={`flex items-center space-x-1 text-green-600 text-xs ${className}`}>
        <span>✅</span>
        <span>ウォーターマークなし</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-1 text-yellow-600 text-xs ${className}`}>
      <span>⚠️</span>
      <span>「{watermarkInfo.watermarkText}」を追加</span>
    </div>
  );
}

/**
 * ウォーターマーク切り替えトグル
 */
export function WatermarkToggle({
  isCommercial,
  onChange,
  disabled = false,
  className = ''
}: {
  isCommercial: boolean;
  onChange: (isCommercial: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`${className}`}>
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={isCommercial}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
        />
        <span className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
          商用利用（ウォーターマークなし）
        </span>
      </label>
      
      <div className="text-xs text-gray-500 mt-1">
        {isCommercial ? (
          <span className="text-green-600">✅ ウォーターマークは追加されません</span>
        ) : (
          <span className="text-yellow-600">⚠️ 「PoseCrafter FREE」ウォーターマークが追加されます</span>
        )}
      </div>
    </div>
  );
}

/**
 * ウォーターマーク比較表示
 */
export function WatermarkComparison({ className = '' }: { className?: string }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {/* 無料版 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-900 mb-2">🆓 無料版</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-600">⚠️</span>
            <span>ウォーターマーク: あり</span>
          </div>
          <div className="text-yellow-700">
            右下に「PoseCrafter FREE」が表示されます
          </div>
          <div className="bg-yellow-100 p-2 rounded text-xs">
            個人利用・学習目的に最適
          </div>
        </div>
      </div>

      {/* 商用版 */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-900 mb-2">💼 商用版</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-green-600">✅</span>
            <span>ウォーターマーク: なし</span>
          </div>
          <div className="text-green-700">
            クリーンな画像を生成できます
          </div>
          <div className="bg-green-100 p-2 rounded text-xs">
            ビジネス・商用利用に最適
          </div>
        </div>
      </div>
    </div>
  );
}