'use client';

// ウォーターマーク機能のテストページ
// 開発者向けの動作確認用ページ

import React, { useState } from 'react';
import Layout from '@/components/Layout';
import WatermarkPreview, { WatermarkIndicator, WatermarkToggle, WatermarkComparison } from '@/components/WatermarkPreview';
import { 
  addUserWatermark, 
  generateWatermarkPreview,
  WATERMARK_CONFIG,
  shouldAddWatermark,
  formatWatermarkInfo 
} from '@/lib/watermark';

export default function WatermarkTestPage() {
  const [userId, setUserId] = useState('guest');
  const [isCommercial, setIsCommercial] = useState(false);
  const [testImage, setTestImage] = useState<string | null>(null);
  const [watermarkedImage, setWatermarkedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // ログ追加
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  };

  // テスト画像生成
  const generateTestImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // グラデーション背景
    const gradient = ctx.createLinearGradient(0, 0, 400, 300);
    gradient.addColorStop(0, '#4F46E5');
    gradient.addColorStop(1, '#7C3AED');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 300);

    // テキスト追加
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('テスト画像', 200, 150);
    
    ctx.font = '16px Arial';
    ctx.fillText('ウォーターマークテスト用', 200, 180);

    const imageData = canvas.toDataURL('image/png');
    setTestImage(imageData);
    addLog('テスト画像を生成しました');
  };

  // ウォーターマーク追加テスト
  const testWatermark = async () => {
    if (!testImage) {
      addLog('エラー: テスト画像がありません');
      return;
    }

    setProcessing(true);
    addLog(`ウォーターマーク追加開始 - ユーザー: ${userId}, 商用: ${isCommercial}`);

    try {
      const result = await addUserWatermark(userId, testImage, isCommercial);
      
      if (result.success && result.imageData) {
        setWatermarkedImage(result.imageData);
        addLog('✅ ウォーターマーク追加成功');
      } else {
        setWatermarkedImage(testImage); // 元画像を表示
        addLog(`ℹ️ ウォーターマークなし: ${result.error || '対象外ユーザー'}`);
      }
    } catch (error) {
      addLog(`❌ エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setProcessing(false);
    }
  };

  // 設定情報表示
  const watermarkInfo = formatWatermarkInfo(userId, isCommercial);
  const needsWatermark = shouldAddWatermark(userId, isCommercial);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🧪 ウォーターマークテスト</h1>
          <p className="text-gray-600">ウォーターマーク機能の動作確認とテスト</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左カラム: 設定とコントロール */}
          <div className="space-y-6">
            {/* テスト設定 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">⚙️ テスト設定</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ユーザーID
                  </label>
                  <select
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="guest">guest (Free)</option>
                    <option value="user123">user123 (Free)</option>
                    <option value="premium_user">premium_user (Premium)</option>
                    <option value="pro_user">pro_user (Pro)</option>
                  </select>
                </div>

                <WatermarkToggle
                  isCommercial={isCommercial}
                  onChange={setIsCommercial}
                  className="pt-2"
                />

                <div className="bg-gray-50 p-3 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">現在の設定</h3>
                  <div className="text-sm space-y-1">
                    <div>ユーザー: <span className="font-mono">{userId}</span></div>
                    <div>商用利用: <span className="font-mono">{isCommercial ? 'Yes' : 'No'}</span></div>
                    <div>ウォーターマーク: <span className="font-mono">{needsWatermark ? 'Yes' : 'No'}</span></div>
                    <div>プラン: <span className="font-mono">{watermarkInfo.planName}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* テスト実行 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">🚀 テスト実行</h2>
              
              <div className="space-y-3">
                <button
                  onClick={generateTestImage}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  1. テスト画像を生成
                </button>
                
                <button
                  onClick={testWatermark}
                  disabled={!testImage || processing}
                  className="w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {processing ? '処理中...' : '2. ウォーターマーク追加'}
                </button>
              </div>
            </div>

            {/* ログ表示 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">📋 ログ</h2>
                <button
                  onClick={() => setLogs([])}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  クリア
                </button>
              </div>
              
              <div className="bg-gray-900 text-green-400 p-3 rounded-lg h-40 overflow-y-auto font-mono text-xs">
                {logs.length === 0 ? (
                  <div className="text-gray-500">ログはまだありません</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 右カラム: プレビューと結果 */}
          <div className="space-y-6">
            {/* ウォーターマークプレビュー */}
            <WatermarkPreview
              userId={userId}
              isCommercial={isCommercial}
              showSettings={true}
            />

            {/* 画像比較 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">📸 画像比較</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 元画像 */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">元画像</h3>
                  <div className="border border-gray-300 rounded-lg p-2 bg-gray-50">
                    {testImage ? (
                      <img 
                        src={testImage} 
                        alt="テスト画像"
                        className="w-full rounded"
                      />
                    ) : (
                      <div className="aspect-[4/3] flex items-center justify-center text-gray-500">
                        テスト画像を生成してください
                      </div>
                    )}
                  </div>
                </div>

                {/* 処理後画像 */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">
                    処理後画像
                    <WatermarkIndicator 
                      userId={userId} 
                      isCommercial={isCommercial}
                      className="ml-2"
                    />
                  </h3>
                  <div className="border border-gray-300 rounded-lg p-2 bg-gray-50">
                    {watermarkedImage ? (
                      <img 
                        src={watermarkedImage} 
                        alt="ウォーターマーク処理後"
                        className="w-full rounded"
                      />
                    ) : (
                      <div className="aspect-[4/3] flex items-center justify-center text-gray-500">
                        ウォーターマーク処理を実行してください
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* プラン比較 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">💼 プラン比較</h2>
              <WatermarkComparison />
            </div>

            {/* 技術情報 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">🔧 技術情報</h2>
              
              <div className="space-y-3 text-sm">
                <div className="bg-gray-50 p-3 rounded">
                  <h3 className="font-medium mb-2">ウォーターマーク設定</h3>
                  {WATERMARK_CONFIG.free ? (
                    <pre className="text-xs bg-gray-800 text-green-400 p-2 rounded overflow-x-auto">
{JSON.stringify(WATERMARK_CONFIG.free, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-gray-500">設定なし</div>
                  )}
                </div>
                
                <div className="bg-gray-50 p-3 rounded">
                  <h3 className="font-medium mb-2">判定ロジック</h3>
                  <div className="font-mono text-xs space-y-1">
                    <div>shouldAddWatermark({userId}, {isCommercial.toString()}) = {needsWatermark.toString()}</div>
                    <div>Plan: {watermarkInfo.planName}</div>
                    <div>Has Watermark: {watermarkInfo.hasWatermark.toString()}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}