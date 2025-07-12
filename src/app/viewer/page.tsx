'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';
import PoseEditor from '@/components/PoseEditor';
import PoseInterpolatorComponent from '@/components/PoseInterpolator';
import { useUsage } from '@/contexts/UsageContext';
import { addToGuestGallery } from '@/lib/gallery';
import { addCommercialWatermark, COMMERCIAL_WATERMARK_PRESETS, downloadImage, generateCommercialFilename } from '@/lib/imageUtils';
import { incrementGuestUsage } from '@/lib/usage';
import ShareCardGenerator from '@/components/ShareCardGenerator';
import StyleSelector from '@/components/StyleSelector';
import { isPremiumUser, canUseFeature } from '@/lib/subscription';
import { applyStyleToPrompt, getStyleById } from '@/lib/aiStyles';
import { PoseData as InterpolationPoseData, SavedPoseManager } from '@/lib/poseInterpolation';

interface PoseData {
  [boneName: string]: {
    rotation: [number, number, number];
    position?: [number, number, number];
  };
}

export default function ViewerPage() {
  const searchParams = useSearchParams();
  const [currentPose, setCurrentPose] = useState<PoseData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('リアル');
  const [background, setBackground] = useState('透明');
  const [resolution, setResolution] = useState('512px');
  const [isCommercial, setIsCommercial] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isProcessingWatermark, setIsProcessingWatermark] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('basic_realistic');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [showPoseInterpolator, setShowPoseInterpolator] = useState(false);
  const { usage, refreshUsage } = useUsage();
  
  // ユーザーのプレミアム状態をチェック
  const userIsPremium = isPremiumUser('guest');
  const canUseAIStyles = canUseFeature('aiStyles', 'guest');

  // ポーズデータ変換ユーティリティ
  const convertToInterpolationFormat = (pose: PoseData): InterpolationPoseData => {
    const result: InterpolationPoseData = {};
    Object.entries(pose).forEach(([boneName, data]) => {
      result[boneName] = {
        x: data.rotation[0],
        y: data.rotation[1],
        z: data.rotation[2]
      };
    });
    return result;
  };

  const convertFromInterpolationFormat = (pose: InterpolationPoseData): PoseData => {
    const result: PoseData = {};
    Object.entries(pose).forEach(([boneName, rotation]) => {
      result[boneName] = {
        rotation: [rotation.x, rotation.y, rotation.z],
        position: [0, 0, 0] // デフォルト位置
      };
    });
    return result;
  };

  useEffect(() => {
    // URLパラメータをチェックしてポーズ補間タブを開く
    const tab = searchParams.get('tab');
    if (tab === 'interpolation') {
      setShowPoseInterpolator(true);
    }

    // テンプレートからのデータを取得
    const templateData = localStorage.getItem('selectedTemplate');
    if (templateData) {
      try {
        const data = JSON.parse(templateData);
        setPrompt(data.prompt || '');
        setStyle(data.style || 'リアル');
        setBackground(data.background || '透明');
        setCurrentPose(data.poseData || null);
        localStorage.removeItem('selectedTemplate');
      } catch (error) {
        console.error('Error loading template data:', error);
      }
    }
    
    // プロンプト組み合わせからのデータを取得
    const selectedPrompt = localStorage.getItem('selectedPrompt');
    if (selectedPrompt) {
      setPrompt(selectedPrompt);
      localStorage.removeItem('selectedPrompt');
    }
  }, [searchParams]);
  
  const handlePoseChange = (pose: PoseData) => {
    setCurrentPose(pose);
  };

  const generateImage = async () => {
    if (!currentPose) {
      alert('まずポーズを調整してください');
      return;
    }

    if (!prompt.trim()) {
      alert('プロンプトを入力してください');
      return;
    }

    // 使用制限チェック
    if (usage.imageGeneration >= 10) {
      alert('本日の画像生成回数の上限に達しました');
      return;
    }

    if (isCommercial && usage.commercialUse >= 2) {
      alert('本日の商用利用回数の上限に達しました');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      // AIスタイルを適用したプロンプトを生成
      const finalPrompt = selectedStyleId ? applyStyleToPrompt(prompt, selectedStyleId) : prompt;
      
      const formData = new FormData();
      formData.append('prompt', finalPrompt);
      formData.append('pose_data', JSON.stringify(currentPose));
      formData.append('style', style);
      formData.append('background', background);
      formData.append('resolution', resolution.replace('px', ''));
      formData.append('is_commercial', isCommercial.toString());
      formData.append('ai_style_id', selectedStyleId);

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        let finalImage = result.image;

        // 商用利用の場合はウォーターマークを追加
        if (isCommercial) {
          setIsProcessingWatermark(true);
          try {
            finalImage = await addCommercialWatermark(result.image, COMMERCIAL_WATERMARK_PRESETS.subtle);
          } catch (error) {
            console.error('Error adding watermark:', error);
            alert('ウォーターマークの追加に失敗しましたが、画像は生成されました');
          } finally {
            setIsProcessingWatermark(false);
          }
        }

        setGeneratedImage(finalImage);

        // ギャラリーに保存
        addToGuestGallery({
          user_id: 'guest',
          prompt,
          pose_data: currentPose,
          style,
          background,
          resolution,
          is_commercial: isCommercial,
          image_base64: finalImage,
          processing_time: result.processing_time || 1500
        });

        // 使用回数をインクリメント
        incrementGuestUsage('imageGeneration');
        if (isCommercial) {
          incrementGuestUsage('commercialUse');
        }
        refreshUsage();

        alert('画像生成が完了しました！');
      } else {
        throw new Error(result.error || '画像生成に失敗しました');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      alert('画像生成中にエラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    
    const filename = isCommercial 
      ? generateCommercialFilename(prompt)
      : `generated-image-${Date.now()}.png`;
    
    downloadImage(generatedImage, filename);
  };

  const handleSaveToGallery = () => {
    if (!generatedImage) return;
    alert('画像がギャラリーに保存されました！');
  };

  const handleShare = () => {
    if (!generatedImage) {
      alert('まず画像を生成してください');
      return;
    }
    setIsShareModalOpen(true);
  };

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyleId(styleId);
    setShowStyleSelector(false);
  };

  const handleInterpolatedPoseChange = (interpolatedPose: InterpolationPoseData) => {
    const convertedPose = convertFromInterpolationFormat(interpolatedPose);
    setCurrentPose(convertedPose);
  };

  const handleSaveCurrentPose = (pose: InterpolationPoseData, name: string, description?: string) => {
    // 保存処理はPoseInterpolatorComponent内で処理される
    console.log('Pose saved:', { name, description, pose });
  };

  const selectedStyle = getStyleById(selectedStyleId);
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">3Dポーズエディター</h1>
          <p className="text-gray-600">モデルの関節をドラッグして理想のポーズを作成しましょう</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 3Dエディター */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <h2 className="text-xl font-semibold">3Dビューアー</h2>
                  <button
                    onClick={() => setShowPoseInterpolator(!showPoseInterpolator)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      showPoseInterpolator
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🔀 ポーズ補間
                  </button>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>関節</span>
                  <div className="w-3 h-3 bg-green-500 rounded-full ml-4"></div>
                  <span>選択中</span>
                </div>
              </div>
              
              {!showPoseInterpolator ? (
                <>
                  <PoseEditor onPoseChange={handlePoseChange} />
                  
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">💡 使い方</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• 赤い球（関節）をクリックして選択</li>
                      <li>• マウスドラッグで関節を回転</li>
                      <li>• マウスホイールでズーム</li>
                      <li>• ポーズの保存/読み込みが可能</li>
                    </ul>
                  </div>
                </>
              ) : (
                <PoseInterpolatorComponent
                  currentPose={currentPose ? convertToInterpolationFormat(currentPose) : undefined}
                  onPoseChange={handleInterpolatedPoseChange}
                  onSavePose={handleSaveCurrentPose}
                />
              )}
            </div>
          </div>
          
          {/* コントロールパネル */}
          <div className="space-y-6">
            {/* ポーズ情報 */}
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">ポーズ情報</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">関節数</span>
                  <span className="font-medium">21個</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">形式</span>
                  <span className="font-medium">JSON</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">状態</span>
                  <span className={`font-medium ${
                    currentPose ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {currentPose ? '編集済み' : '初期状態'}
                  </span>
                </div>
              </div>
              
              {currentPose && (
                <div className="mt-4 p-3 bg-gray-50 rounded">
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                      JSONデータを表示
                    </summary>
                    <pre className="text-xs text-gray-600 overflow-auto max-h-32">
                      {JSON.stringify(currentPose, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
            
            {/* 画像生成 */}
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">AI画像生成</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">プロンプト *</label>
                    <div className="flex space-x-2">
                      <a
                        href="/prompts"
                        className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        📝 プロンプト管理
                      </a>
                      <a
                        href="/prompt-builder"
                        className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        🎨 組み合わせ作成
                      </a>
                    </div>
                  </div>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="生成したい画像の説明を入力..."
                    className="w-full border rounded-lg px-3 py-2 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 プロンプト管理ページでカテゴリ別に整理・組み合わせできます
                  </p>
                </div>

                {/* AIスタイル選択 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">AIスタイル</label>
                    <button
                      onClick={() => setShowStyleSelector(!showStyleSelector)}
                      className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
                    >
                      {showStyleSelector ? '閉じる' : '詳細選択'}
                    </button>
                  </div>
                  
                  {selectedStyle && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-lg">{selectedStyle.thumbnail}</span>
                        <span className="font-medium text-sm">{selectedStyle.name}</span>
                        {selectedStyle.isPremium && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">
                            Premium
                          </span>
                        )}
                        {selectedStyle.isNew && (
                          <span className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded-full">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">{selectedStyle.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        タグ: <code className="bg-gray-200 px-1 rounded text-xs">{selectedStyle.promptTag}</code>
                      </p>
                    </div>
                  )}
                  
                  {showStyleSelector && (
                    <div className="mb-4">
                      <StyleSelector
                        selectedStyleId={selectedStyleId}
                        onStyleSelect={handleStyleSelect}
                        isPremiumUser={userIsPremium}
                        compact={true}
                      />
                    </div>
                  )}
                  
                  {!userIsPremium && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                      <p className="text-yellow-800">
                        💡 プレミアムプランで月替わりの豊富なAIスタイルをお楽しみください！
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">スタイル</label>
                  <select 
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="リアル">リアル</option>
                    <option value="アニメ">アニメ</option>
                    <option value="イラスト">イラスト</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">背景</label>
                  <select 
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="透明">透明</option>
                    <option value="白">白</option>
                    <option value="スタジオ">スタジオ</option>
                    <option value="自然">自然</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">品質</label>
                  <select 
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="512px">標準 (512px)</option>
                    <option disabled>高品質 (1024px) - Pro</option>
                  </select>
                </div>

                {/* 商用利用オプション */}
                <div className="border-t pt-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="commercial"
                      checked={isCommercial}
                      onChange={(e) => setIsCommercial(e.target.checked)}
                      disabled={usage.commercialUse >= 2}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="commercial" className="text-sm font-medium text-gray-700">
                      商用利用マーク付きで生成
                    </label>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500">
                    <p>商用利用: {usage.commercialUse}/2回 (本日)</p>
                    {isCommercial && (
                      <p className="text-purple-600 mt-1">
                        ⚠️ 画像にCOMMERCIALウォーターマークが追加されます
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <button
                onClick={generateImage}
                disabled={!currentPose || isGenerating || !prompt.trim()}
                className={`w-full mt-6 py-3 rounded-lg font-semibold transition-colors ${
                  !currentPose || isGenerating || !prompt.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white'
                }`}
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>生成中...</span>
                  </div>
                ) : (
                  '画像を生成'
                )}
              </button>
              
              <div className="text-xs text-gray-500 mt-2 text-center space-y-1">
                <p>画像生成: {usage.imageGeneration}/10回 (本日)</p>
                {isProcessingWatermark && (
                  <p className="text-blue-600">ウォーターマーク処理中...</p>
                )}
              </div>
            </div>
            
            {/* プレビュー */}
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">生成結果</h3>
              <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-4 overflow-hidden">
                {generatedImage ? (
                  <img
                    src={generatedImage}
                    alt="Generated image"
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">生成された画像が<br />ここに表示されます</p>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={handleDownload}
                  disabled={!generatedImage}
                  className="px-3 py-2 text-sm border rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ダウンロード
                </button>
                <button 
                  onClick={handleShare}
                  disabled={!generatedImage}
                  className="px-3 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                >
                  <span>📱</span>
                  <span>共有</span>
                </button>
                <button 
                  onClick={handleSaveToGallery}
                  disabled={!generatedImage}
                  className="px-3 py-2 text-sm border rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  保存済み
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* シェアカード生成モーダル */}
      <ShareCardGenerator
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        generatedImage={generatedImage || ''}
        prompt={prompt}
        poseData={currentPose}
        style={style}
        background={background}
        isCommercial={isCommercial}
      />
    </Layout>
  );
}