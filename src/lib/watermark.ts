// ウォーターマーク追加ライブラリ
// Freeユーザーの画像に「PoseCrafter FREE」ウォーターマークを追加

// ユーザーサブスクリプション型定義
interface UserSubscription {
  plan: 'free' | 'premium' | 'pro' | 'commercial';
  isCommercial: boolean;
  hasWatermark: boolean;
}

/**
 * ユーザーのサブスクリプション情報を取得
 * 現在はシンプルなロジックで実装
 */
export function getUserSubscription(userId: string): UserSubscription {
  // ゲストユーザーはFreeプラン
  if (userId === 'guest' || !userId) {
    return {
      plan: 'free',
      isCommercial: false,
      hasWatermark: true
    };
  }
  
  // TODO: 実際のSupabaseからユーザーのサブスクリプション情報を取得
  // const subscription = await supabase.from('subscriptions').select('*').eq('user_id', userId).single();
  
  // 現在はデフォルトでFreeプランとして処理
  return {
    plan: 'free',
    isCommercial: false,
    hasWatermark: true
  };
}

// ウォーターマーク設定
export const WATERMARK_CONFIG = {
  free: {
    text: 'PoseCrafter FREE',
    position: 'bottom-right' as const,
    opacity: 0.8,
    fontSize: 18,
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    margin: 15
  },
  premium: null, // プレミアムユーザーはウォーターマークなし
  pro: null, // プロユーザーはウォーターマークなし
  commercial: null // 商用ユーザーはウォーターマークなし
} as const;

// ウォーターマーク位置の型定義
export type WatermarkPosition = 
  | 'top-left' 
  | 'top-right' 
  | 'bottom-left' 
  | 'bottom-right' 
  | 'center';

// ウォーターマーク設定の型定義
export interface WatermarkSettings {
  text: string;
  position: WatermarkPosition;
  opacity: number;
  fontSize: number;
  color: string;
  backgroundColor: string;
  padding: number;
  margin: number;
}

// ウォーターマーク追加結果の型定義
export interface WatermarkResult {
  success: boolean;
  imageData?: string; // Base64 data URL
  error?: string;
}

/**
 * ユーザーにウォーターマークが必要かどうかをチェック
 * Freeユーザーおよびゲストユーザーにウォーターマークを追加
 * 商用ユーザーはウォーターマークなし
 */
export function shouldAddWatermark(userId: string, isCommercialUse: boolean = false): boolean {
  // 商用利用の場合はウォーターマークを追加しない
  if (isCommercialUse) {
    return false;
  }
  
  const subscription = getUserSubscription(userId);
  
  // Freeプランおよびゲストユーザーのみウォーターマークあり
  return subscription.plan === 'free';
}

/**
 * ユーザーのウォーターマーク設定を取得
 */
export function getWatermarkSettings(userId: string): WatermarkSettings | null {
  const subscription = getUserSubscription(userId);
  return WATERMARK_CONFIG[subscription.plan] || null;
}

/**
 * Canvas上にウォーターマークを描画
 */
function drawWatermarkOnCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  settings: WatermarkSettings
): void {
  const { text, position, opacity, fontSize, color, backgroundColor, padding, margin } = settings;

  // フォント設定
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // テキストサイズを測定
  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;
  const textHeight = fontSize;

  // 背景のサイズ
  const bgWidth = textWidth + padding * 2;
  const bgHeight = textHeight + padding * 2;

  // 位置を計算
  let x = 0;
  let y = 0;

  switch (position) {
    case 'top-left':
      x = margin;
      y = margin;
      break;
    case 'top-right':
      x = canvas.width - bgWidth - margin;
      y = margin;
      break;
    case 'bottom-left':
      x = margin;
      y = canvas.height - bgHeight - margin;
      break;
    case 'bottom-right':
      x = canvas.width - bgWidth - margin;
      y = canvas.height - bgHeight - margin;
      break;
    case 'center':
      x = (canvas.width - bgWidth) / 2;
      y = (canvas.height - bgHeight) / 2;
      break;
  }

  // グローバル透明度を設定
  ctx.globalAlpha = opacity;

  // 背景を描画
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(x, y, bgWidth, bgHeight);

  // テキストを描画
  ctx.fillStyle = color;
  ctx.fillText(text, x + padding, y + padding);

  // 透明度をリセット
  ctx.globalAlpha = 1.0;
}

/**
 * 画像にウォーターマークを追加（Canvas使用）
 */
export async function addWatermarkToImage(
  imageData: string | HTMLImageElement,
  settings: WatermarkSettings
): Promise<WatermarkResult> {
  try {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve({
          success: false,
          error: 'Canvas context の取得に失敗しました'
        });
        return;
      }

      let img: HTMLImageElement;

      if (typeof imageData === 'string') {
        img = new Image();
        img.crossOrigin = 'anonymous'; // CORS対応
        
        img.onload = () => {
          processImage();
        };

        img.onerror = () => {
          resolve({
            success: false,
            error: '画像の読み込みに失敗しました'
          });
        };

        img.src = imageData;
      } else {
        img = imageData;
        processImage();
      }

      function processImage() {
        try {
          // キャンバスサイズを画像サイズに合わせる
          canvas.width = img.width;
          canvas.height = img.height;

          // 元画像を描画
          ctx.drawImage(img, 0, 0);

          // ウォーターマークを描画
          drawWatermarkOnCanvas(canvas, ctx, settings);

          // 結果をBase64として取得
          const resultImageData = canvas.toDataURL('image/png', 0.9);

          resolve({
            success: true,
            imageData: resultImageData
          });

        } catch (error) {
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'ウォーターマーク処理中にエラーが発生しました'
          });
        }
      }
    });

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '予期しないエラーが発生しました'
    };
  }
}

/**
 * Base64画像にウォーターマークを追加
 */
export async function addWatermarkToBase64Image(
  base64ImageData: string,
  settings: WatermarkSettings
): Promise<WatermarkResult> {
  return addWatermarkToImage(base64ImageData, settings);
}

/**
 * ユーザーの画像に適切なウォーターマークを追加
 * 商用ユーザーはウォーターマークなし
 */
export async function addUserWatermark(
  userId: string,
  imageData: string,
  isCommercialUse: boolean = false
): Promise<WatermarkResult> {
  try {
    console.log(`🎨 Watermark check for user: ${userId}, commercial: ${isCommercialUse}`);
    
    // ウォーターマークが必要かチェック
    if (!shouldAddWatermark(userId, isCommercialUse)) {
      console.log('✅ No watermark required for this user/usage type');
      // プレミアム/プロユーザーまたは商用利用はウォーターマークなし
      return {
        success: true,
        imageData
      };
    }

    console.log('📝 Adding watermark for Free user');
    
    // Freeユーザーのウォーターマーク設定を取得
    const settings = getWatermarkSettings(userId);
    if (!settings) {
      console.error('❌ Failed to get watermark settings');
      return {
        success: false,
        error: 'ウォーターマーク設定の取得に失敗しました'
      };
    }

    // ウォーターマークを追加
    const result = await addWatermarkToImage(imageData, settings);
    
    if (result.success) {
      console.log('✅ Watermark added successfully');
    } else {
      console.error('❌ Watermark addition failed:', result.error);
    }
    
    return result;

  } catch (error) {
    console.error('ユーザーウォーターマーク追加エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ウォーターマーク追加中にエラーが発生しました'
    };
  }
}

/**
 * 複数画像に一括でウォーターマークを追加
 */
export async function addWatermarkToMultipleImages(
  userId: string,
  imageDataList: string[],
  isCommercialUse: boolean = false
): Promise<Array<WatermarkResult & { originalIndex: number }>> {
  const results = await Promise.allSettled(
    imageDataList.map(async (imageData, index) => ({
      originalIndex: index,
      result: await addUserWatermark(userId, imageData, isCommercialUse)
    }))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return {
        originalIndex: result.value.originalIndex,
        ...result.value.result
      };
    } else {
      return {
        originalIndex: index,
        success: false,
        error: result.reason instanceof Error ? result.reason.message : '処理に失敗しました'
      };
    }
  });
}

/**
 * カスタムウォーターマーク設定でウォーターマークを追加
 */
export async function addCustomWatermark(
  imageData: string,
  customSettings: Partial<WatermarkSettings>
): Promise<WatermarkResult> {
  const defaultSettings = WATERMARK_CONFIG.free;
  if (!defaultSettings) {
    return {
      success: false,
      error: 'デフォルトウォーターマーク設定が見つかりません'
    };
  }

  const finalSettings: WatermarkSettings = {
    ...defaultSettings,
    ...customSettings
  };

  return await addWatermarkToImage(imageData, finalSettings);
}

/**
 * ウォーターマークのプレビューを生成
 */
export async function generateWatermarkPreview(
  settings: WatermarkSettings,
  previewSize: { width: number; height: number } = { width: 400, height: 300 }
): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    canvas.width = previewSize.width;
    canvas.height = previewSize.height;

    // 背景（グレーのチェッカーボード模様）
    const checkerSize = 20;
    for (let x = 0; x < canvas.width; x += checkerSize) {
      for (let y = 0; y < canvas.height; y += checkerSize) {
        ctx.fillStyle = ((x / checkerSize) + (y / checkerSize)) % 2 === 0 ? '#f0f0f0' : '#e0e0e0';
        ctx.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    // ウォーターマークを描画
    drawWatermarkOnCanvas(canvas, ctx, settings);

    return canvas.toDataURL('image/png');

  } catch (error) {
    console.error('ウォーターマークプレビュー生成エラー:', error);
    return null;
  }
}

/**
 * ウォーターマーク設定の妥当性をチェック
 */
export function validateWatermarkSettings(settings: Partial<WatermarkSettings>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (settings.text && settings.text.length > 50) {
    errors.push('テキストは50文字以内で入力してください');
  }

  if (settings.opacity && (settings.opacity < 0 || settings.opacity > 1)) {
    errors.push('透明度は0から1の間で設定してください');
  }

  if (settings.fontSize && (settings.fontSize < 8 || settings.fontSize > 72)) {
    errors.push('フォントサイズは8pxから72pxの間で設定してください');
  }

  if (settings.padding && (settings.padding < 0 || settings.padding > 50)) {
    errors.push('パディングは0pxから50pxの間で設定してください');
  }

  if (settings.margin && (settings.margin < 0 || settings.margin > 100)) {
    errors.push('マージンは0pxから100pxの間で設定してください');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * ウォーターマーク情報を表示用フォーマットに変換
 */
export function formatWatermarkInfo(userId: string, isCommercialUse: boolean = false): {
  hasWatermark: boolean;
  planName: string;
  watermarkText?: string;
  upgradeMessage?: string;
} {
  const subscription = getUserSubscription(userId);
  const hasWatermark = shouldAddWatermark(userId, isCommercialUse);

  if (!hasWatermark) {
    return {
      hasWatermark: false,
      planName: subscription.plan
    };
  }

  return {
    hasWatermark: true,
    planName: subscription.plan,
    watermarkText: WATERMARK_CONFIG.free?.text,
    upgradeMessage: isCommercialUse 
      ? '商用プランにアップグレードすると、ウォーターマークなしで商用利用が可能です。'
      : 'プレミアムプランにアップグレードすると、ウォーターマークが除去されます。'
  };
}

/**
 * サーバーサイドでCanvasを使ってウォーターマークを追加（Node.js用）
 */
export async function addWatermarkServerSide(
  imageBase64: string,
  settings: WatermarkSettings
): Promise<WatermarkResult> {
  try {
    // Node.js環境でcanvasライブラリを使用
    if (typeof window === 'undefined') {
      // TODO: node-canvasを使ったサーバーサイド処理を実装
      // const { createCanvas, loadImage } = require('canvas');
      
      console.warn('サーバーサイドウォーターマーク処理は未実装です');
      return {
        success: true,
        imageData: imageBase64 // 一時的に元画像を返す
      };
    }
    
    // ブラウザー環境では通常の処理を実行
    return await addWatermarkToImage(imageBase64, settings);
    
  } catch (error) {
    console.error('サーバーサイドウォーターマークエラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'サーバーサイドウォーターマーク処理に失敗しました'
    };
  }
}