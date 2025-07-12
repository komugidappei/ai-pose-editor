'use client';

import { useState, useCallback } from 'react';
import { useRecaptchaVerification } from './RecaptchaWrapper';
import RecaptchaWrapper from './RecaptchaWrapper';
import GuestRecaptcha from './GuestRecaptcha';
import ImageLimitNotification from './ImageLimitNotification';
import { sanitizeImage } from '@/lib/imageUpload';
import { escapeHtml, sanitizePrompt } from '@/lib/htmlEscape';
import { useImageLimit } from '@/lib/imageLimit';
import { useDailyLimit } from '@/hooks/useDailyLimit';
import DailyLimitIndicator from './DailyLimitIndicator';
import WatermarkPreview from './WatermarkPreview';
import { formatWatermarkInfo } from '@/lib/watermark';

interface SecureImageGeneratorProps {
  currentPose?: any;
  isAuthenticated?: boolean;
  userId?: string;
  onImageGenerated?: (result: any) => void;
  onError?: (error: string) => void;
}

export default function SecureImageGenerator({
  currentPose,
  isAuthenticated = false,
  userId = 'guest',
  onImageGenerated,
  onError
}: SecureImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('リアル');
  const [background, setBackground] = useState('透明');
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [lastDeletedCount, setLastDeletedCount] = useState(0);

  // セキュリティ関連のフック
  const recaptcha = useRecaptchaVerification();
  const imageLimit = useImageLimit(userId);
  const dailyLimit = useDailyLimit({ userId, isAuthenticated });

  // ウォーターマーク情報
  const [isCommercial, setIsCommercial] = useState(false);
  const watermarkInfo = formatWatermarkInfo(userId, isCommercial);

  // プロンプト入力の処理
  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const sanitized = sanitizePrompt(value);
    setPrompt(sanitized);
  }, []);

  // 画像アップロードの処理
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingImage(true);
    try {
      // 画像のセキュリティ検証と再エンコード
      const processed = await sanitizeImage(file);
      
      // 処理された画像をFileオブジェクトとして作成
      const processedFile = new File([processed.buffer], processed.filename, {
        type: processed.mimeType
      });
      
      setUploadedImage(processedFile);
      
      console.log('画像処理完了:', {
        originalSize: processed.originalSize,
        processedSize: processed.processedSize,
        compressionRatio: (processed.originalSize / processed.processedSize).toFixed(2)
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '画像処理に失敗しました';
      onError?.(errorMessage);
    } finally {
      setProcessingImage(false);
    }
  }, [onError]);

  // セキュア画像生成
  const handleSecureGenerate = useCallback(async () => {
    try {
      setIsGenerating(true);

      // 1. 基本検証
      if (!currentPose) {
        onError?.('ポーズデータが設定されていません');
        return;
      }

      if (!prompt.trim()) {
        onError?.('プロンプトを入力してください');
        return;
      }

      // 2. 日次生成制限チェック（1日10回）
      if (!dailyLimit.checkCanGenerate()) {
        onError?.(日次制限に達しています。明日の午前2時にリセットされます。');
        return;
      }

      if (!imageLimit.stats?.canSaveMore) {
        onError?.('保存画像数の制限に達しています');
        return;
      }

      // 3. reCAPTCHA検証（ゲストユーザーのみ）
      let recaptchaToken = null;
      if (!isAuthenticated) {
        if (!recaptcha.isVerified || !recaptcha.token) {
          onError?.('reCAPTCHA認証を完了してください');
          return;
        }
        recaptchaToken = recaptcha.token;
      }

      // 4. リクエストデータを準備
      const requestData = {
        prompt: sanitizePrompt(prompt),
        poseData: currentPose,
        style: escapeHtml(style),
        background: escapeHtml(background),
        resolution: '512',
        isCommercial: isCommercial,
        aiStyleId: '',
        recaptchaToken
      };

      // 5. セキュアAPI呼び出し
      const response = await fetch('/api/generate-secure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Start-Time': Date.now().toString(),
          ...(isAuthenticated ? {
            'Authorization': `Bearer ${await getAuthToken()}`
          } : {})
        },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      if (!result.success) {
        throw new Error(result.error || '画像生成に失敗しました');
      }

      // 6. 成功時の処理
      onImageGenerated?.(result);

      // 自動削除された画像数を記録
      if (result.metadata?.deletedOldImages > 0) {
        setLastDeletedCount(result.metadata.deletedOldImages);
      }

      // 統計を更新
      await dailyLimit.refreshSummary();
      await imageLimit.refreshStats();

      // reCAPTCHAをリセット
      if (!isAuthenticated) {
        recaptcha.reset();
      }

    } catch (error) {
      console.error('セキュア画像生成エラー:', error);
      const errorMessage = error instanceof Error ? error.message : '画像生成中にエラーが発生しました';
      onError?.(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [
    currentPose, 
    prompt, 
    style, 
    background, 
    isAuthenticated, 
    recaptcha, 
    dailyLimit, 
    imageLimit, 
    onImageGenerated, 
    onError
  ]);

  // 認証トークン取得（実装は認証システムに依存）
  const getAuthToken = async (): Promise<string> => {
    // Supabase Auth の場合
    // const { data: { session } } = await supabase.auth.getSession();
    // return session?.access_token || '';
    return ''; // 実装必要
  };

  return (
    <div className="space-y-6">
      {/* セキュリティ状態の表示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">🔒 セキュリティ状態</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-blue-700">認証状態:</span>
            <span className={`ml-2 font-medium ${isAuthenticated ? 'text-green-600' : 'text-orange-600'}`}>
              {isAuthenticated ? '✅ ログイン済み' : '🔓 ゲストユーザー'}
            </span>
          </div>
          <div>
            <span className="text-blue-700">今日の生成回数:</span>
            <span className="ml-2 font-medium">
              {dailyLimit.limitStatus?.currentCount || 0}/
              {dailyLimit.limitStatus?.limit || 10}
            </span>
          </div>
          <div>
            <span className="text-blue-700">保存画像数:</span>
            <span className="ml-2 font-medium">
              {imageLimit.stats?.currentCount || 0}/
              {imageLimit.stats?.limit === -1 ? '無制限' : imageLimit.stats?.limit}
            </span>
          </div>
          <div>
            <span className="text-blue-700">ウォーターマーク:</span>
            <span className={`ml-2 font-medium ${watermarkInfo.hasWatermark ? 'text-orange-600' : 'text-green-600'}`}>
              {watermarkInfo.hasWatermark ? '⚠️ 追加されます' : '✅ なし'}
            </span>
          </div>
        </div>
      </div>

      {/* 日次生成制限の表示 */}
      <DailyLimitIndicator
        limitStatus={dailyLimit.limitStatus}
        isAuthenticated={isAuthenticated}
        onRefresh={dailyLimit.refreshStatus}
        className="mb-4"
      />

      {/* 画像制限の通知 */}
      {imageLimit.stats && (
        <ImageLimitNotification
          currentCount={imageLimit.stats.currentCount}
          limit={imageLimit.stats.limit}
          deletedOldImages={lastDeletedCount}
          planName={imageLimit.stats.planName}
          className="mb-4"
        />
      )}

      {/* プロンプト入力 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          プロンプト *
        </label>
        <textarea
          value={prompt}
          onChange={handlePromptChange}
          placeholder="生成したい画像の説明を入力してください..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={1000}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>HTMLタグは自動的にエスケープされます</span>
          <span>{prompt.length}/1000</span>
        </div>
      </div>

      {/* スタイル・背景設定 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            スタイル
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="リアル">リアル</option>
            <option value="アニメ">アニメ</option>
            <option value="イラスト">イラスト</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            背景
          </label>
          <select
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="透明">透明</option>
            <option value="白">白</option>
            <option value="スタジオ">スタジオ</option>
            <option value="自然">自然</option>
          </select>
        </div>
      </div>

      {/* 画像アップロード（オプション） */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          参照画像（オプション）
        </label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handleImageUpload}
          disabled={processingImage}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {processingImage && (
          <div className="mt-2 text-blue-600 text-sm flex items-center space-x-2">
            <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>画像を処理中...</span>
          </div>
        )}
        {uploadedImage && (
          <div className="mt-2 text-green-600 text-sm">
            ✅ 画像が安全に処理されました: {uploadedImage.name}
          </div>
        )}
        <div className="text-xs text-gray-500 mt-1">
          対応形式: PNG, JPEG, JPG（最大10MB）
          <br />
          アップロードされた画像は自動的に512pxにリサイズされ、メタデータが除去されます。
        </div>
      </div>

      {/* 商用利用オプション */}
      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={isCommercial}
            onChange={(e) => setIsCommercial(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            商用利用（ウォーターマークなし）
          </span>
        </label>
        <div className="text-xs text-gray-500 mt-1">
          商用利用の場合、ウォーターマークなしで画像を生成します。
        </div>
      </div>

      {/* reCAPTCHA（ゲストユーザーのみ） */}
      {!isAuthenticated && (
        <GuestRecaptcha
          isAuthenticated={isAuthenticated}
          onVerify={recaptcha.handleVerify}
          onError={(error) => onError?.(error)}
          onExpired={recaptcha.handleExpired}
          disabled={isGenerating}
          className="space-y-3"
        />
      )}

      {/* ウォーターマークプレビュー */}
      <WatermarkPreview
        userId={userId}
        isCommercial={isCommercial}
        className="mb-4"
      />

      {/* 生成ボタン */}
      <button
        onClick={handleSecureGenerate}
        disabled={
          isGenerating || 
          !prompt.trim() || 
          !currentPose ||
          (!isAuthenticated && !recaptcha.isVerified) ||
          !dailyLimit.checkCanGenerate() ||
          !imageLimit.stats?.canSaveMore
        }
        className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
          isGenerating ||
          !prompt.trim() ||
          !currentPose ||
          (!isAuthenticated && !recaptcha.isVerified) ||
          !dailyLimit.checkCanGenerate() ||
          !imageLimit.stats?.canSaveMore
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white shadow-lg hover:shadow-xl'
        }`}
      >
        {isGenerating ? (
          <div className="flex items-center justify-center space-x-3">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>セキュア生成中...</span>
          </div>
        ) : (
          '🔒 セキュア画像生成'
        )}
      </button>

      {/* 制限情報表示 */}
      <div className="text-xs text-gray-500 space-y-1">
        {!dailyLimit.checkCanGenerate() && (
          <p className="text-red-600">⚠️ 本日の生成制限（1日10回）に達しています</p>
        )}
        {!imageLimit.stats?.canSaveMore && (
          <p className="text-red-600">⚠️ 保存画像数の制限に達しています</p>
        )}
        <p>• 生成には数秒から数十秒かかる場合があります</p>
        <p>• 生成された画像は自動的に安全なストレージに保存されます</p>
        <p>• 不適切なコンテンツの生成は禁止されています</p>
      </div>
    </div>
  );
}