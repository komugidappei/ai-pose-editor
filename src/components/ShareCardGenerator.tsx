'use client';

import { useState, useEffect } from 'react';
import { 
  generateShareCard, 
  copyToClipboard, 
  downloadShareCard,
  SHARE_CARD_TEMPLATES,
  type ShareCardOptions,
  type ShareCardTemplate 
} from '@/lib/shareCard';

interface ShareCardGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  generatedImage: string;
  prompt: string;
  poseData?: any;
  style?: string;
  background?: string;
  isCommercial?: boolean;
}

export default function ShareCardGenerator({
  isOpen,
  onClose,
  generatedImage,
  prompt,
  poseData,
  style = 'AI Generated',
  background = '',
  isCommercial = false
}: ShareCardGeneratorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('twitter');
  const [customOptions, setCustomOptions] = useState({
    userName: 'AI Artist',
    theme: 'light' as 'light' | 'dark' | 'gradient'
  });
  const [shareCardPreview, setShareCardPreview] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');

  // プレビュー生成
  useEffect(() => {
    if (isOpen && generatedImage) {
      generatePreview();
    }
  }, [isOpen, selectedTemplate, customOptions, generatedImage]);

  const generatePreview = async () => {
    if (!generatedImage) return;
    
    setIsGenerating(true);
    try {
      const template = SHARE_CARD_TEMPLATES[selectedTemplate];
      const options: ShareCardOptions = {
        generatedImage,
        prompt,
        poseData,
        style,
        background,
        isCommercial,
        userName: customOptions.userName,
        layout: template.layout,
        theme: customOptions.theme
      };

      const shareCard = await generateShareCard(options);
      setShareCardPreview(shareCard);
    } catch (error) {
      console.error('Failed to generate share card:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (shareCardPreview) {
      downloadShareCard(shareCardPreview, prompt);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!shareCardPreview) return;
    
    setCopyStatus('copying');
    try {
      const success = await copyToClipboard(shareCardPreview);
      setCopyStatus(success ? 'success' : 'error');
      
      setTimeout(() => {
        setCopyStatus('idle');
      }, 3000);
    } catch (error) {
      setCopyStatus('error');
      setTimeout(() => {
        setCopyStatus('idle');
      }, 3000);
    }
  };

  const getCopyButtonText = () => {
    switch (copyStatus) {
      case 'copying': return 'コピー中...';
      case 'success': return 'コピー完了！';
      case 'error': return 'コピー失敗';
      default: return 'クリップボードにコピー';
    }
  };

  const getCopyButtonStyle = () => {
    switch (copyStatus) {
      case 'copying': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'success': return 'bg-green-500 hover:bg-green-600';
      case 'error': return 'bg-red-500 hover:bg-red-600';
      default: return 'bg-purple-500 hover:bg-purple-600';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
        <div className="p-6">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
                <span>📱</span>
                <span>SNS共有カード作成</span>
              </h2>
              <p className="text-gray-600 mt-2">生成した画像をSNSで共有するための美しいカードを作成します</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 設定パネル */}
            <div className="space-y-6">
              {/* テンプレート選択 */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <span>🎨</span>
                  <span>テンプレート選択</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(SHARE_CARD_TEMPLATES).map(([key, template]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedTemplate(key)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        selectedTemplate === key
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{template.name}</h4>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {template.width}×{template.height}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span className="bg-gray-200 px-2 py-1 rounded">{template.layout}</span>
                        <span className="bg-gray-200 px-2 py-1 rounded">{template.theme}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* カスタマイズオプション */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <span>⚙️</span>
                  <span>カスタマイズ</span>
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ユーザー名
                    </label>
                    <input
                      type="text"
                      value={customOptions.userName}
                      onChange={(e) => setCustomOptions(prev => ({ ...prev, userName: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="あなたの名前"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      テーマ
                    </label>
                    <select
                      value={customOptions.theme}
                      onChange={(e) => setCustomOptions(prev => ({ ...prev, theme: e.target.value as 'light' | 'dark' | 'gradient' }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="light">ライト</option>
                      <option value="dark">ダーク</option>
                      <option value="gradient">グラデーション</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 画像情報 */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <span>ℹ️</span>
                  <span>画像情報</span>
                </h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">スタイル:</span>
                    <span className="font-medium">{style}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">背景:</span>
                    <span className="font-medium">{background || '指定なし'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">商用利用:</span>
                    <span className={`font-medium ${isCommercial ? 'text-purple-600' : 'text-gray-500'}`}>
                      {isCommercial ? 'あり' : 'なし'}
                    </span>
                  </div>
                  <div className="pt-2 border-t">
                    <span className="text-gray-600 text-xs">プロンプト:</span>
                    <p className="text-gray-800 text-xs mt-1 p-2 bg-white rounded border max-h-20 overflow-y-auto">
                      {prompt}
                    </p>
                  </div>
                </div>
              </div>

              {/* アクションボタン */}
              <div className="space-y-3">
                <button
                  onClick={generatePreview}
                  disabled={isGenerating}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>生成中...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>プレビュー更新</span>
                    </>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleDownload}
                    disabled={!shareCardPreview}
                    className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>ダウンロード</span>
                  </button>

                  <button
                    onClick={handleCopyToClipboard}
                    disabled={!shareCardPreview}
                    className={`${getCopyButtonStyle()} disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="text-xs">{getCopyButtonText()}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* プレビューエリア */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <span>👀</span>
                <span>プレビュー</span>
              </h3>
              
              <div className="bg-white rounded-lg p-4 border-2 border-dashed border-gray-300 min-h-96 flex items-center justify-center">
                {shareCardPreview ? (
                  <div className="text-center">
                    <img
                      src={shareCardPreview}
                      alt="Share Card Preview"
                      className="max-w-full max-h-80 rounded-lg shadow-lg mx-auto mb-4"
                    />
                    <div className="text-sm text-gray-600">
                      {SHARE_CARD_TEMPLATES[selectedTemplate].width} × {SHARE_CARD_TEMPLATES[selectedTemplate].height}px
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    <div className="text-6xl mb-4">🖼️</div>
                    <p className="text-lg font-medium mb-2">シェアカードのプレビュー</p>
                    <p className="text-sm">「プレビュー更新」ボタンを押してシェアカードを生成してください</p>
                  </div>
                )}
              </div>

              {shareCardPreview && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center space-x-2">
                    <span>💡</span>
                    <span>SNS投稿のヒント</span>
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• ハッシュタグ #PoseCrafterで作った #AI画像生成 が自動で含まれます</li>
                    <li>• 画像と一緒に投稿文も準備しましょう</li>
                    <li>• 商用利用の場合は適切な表記を忘れずに</li>
                    <li>• クリエイティブな説明で多くの人に見てもらいましょう！</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* 推奨投稿文 */}
          {shareCardPreview && (
            <div className="mt-8 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <span>📝</span>
                <span>推奨投稿文</span>
              </h3>
              
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-gray-800 leading-relaxed">
                  AI Pose Editorで{isCommercial ? '商用利用可能な' : ''}画像を生成しました！🎨<br/>
                  <br/>
                  ✨ スタイル: {style}<br/>
                  {background && `🏞️ 背景: ${background}`}<br/>
                  🤖 プロンプト: {prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt}<br/>
                  <br/>
                  #PoseCrafterで作った #AI画像生成 #AIart #デジタルアート
                  {isCommercial && ' #商用利用可'}
                </p>
              </div>
              
              <button
                onClick={() => {
                  const text = `AI Pose Editorで${isCommercial ? '商用利用可能な' : ''}画像を生成しました！🎨\n\n✨ スタイル: ${style}\n${background ? `🏞️ 背景: ${background}\n` : ''}🤖 プロンプト: ${prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt}\n\n#PoseCrafterで作った #AI画像生成 #AIart #デジタルアート${isCommercial ? ' #商用利用可' : ''}`;
                  navigator.clipboard.writeText(text);
                }}
                className="mt-3 text-sm bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                投稿文をコピー
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}