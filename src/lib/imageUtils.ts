'use client';

// 商用利用マークを画像に追加する関数
export function addCommercialWatermark(
  imageDataUrl: string, 
  options: {
    text?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
    opacity?: number;
    padding?: number;
  } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const {
      text = 'COMMERCIAL',
      fontSize = 16,
      color = '#ffffff',
      backgroundColor = 'rgba(0, 0, 0, 0.7)',
      position = 'bottom-right',
      opacity = 1,
      padding = 10
    } = options;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      // キャンバスサイズを画像に合わせる
      canvas.width = img.width;
      canvas.height = img.height;
      
      // 元画像を描画
      ctx.drawImage(img, 0, 0);
      
      // フォント設定
      ctx.font = `bold ${fontSize}px Arial`;
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = fontSize;
      
      // ウォーターマークの背景サイズ
      const bgWidth = textWidth + padding * 2;
      const bgHeight = textHeight + padding * 2;
      
      // 位置計算
      let x: number, y: number;
      
      switch (position) {
        case 'bottom-right':
          x = canvas.width - bgWidth - 10;
          y = canvas.height - bgHeight - 10;
          break;
        case 'bottom-left':
          x = 10;
          y = canvas.height - bgHeight - 10;
          break;
        case 'top-right':
          x = canvas.width - bgWidth - 10;
          y = 10;
          break;
        case 'top-left':
          x = 10;
          y = 10;
          break;
        case 'center':
          x = (canvas.width - bgWidth) / 2;
          y = (canvas.height - bgHeight) / 2;
          break;
        default:
          x = canvas.width - bgWidth - 10;
          y = canvas.height - bgHeight - 10;
      }
      
      // 透明度設定
      ctx.globalAlpha = opacity;
      
      // 背景描画
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(x, y, bgWidth, bgHeight);
      
      // テキスト描画
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(text, x + padding, y + padding);
      
      // 透明度をリセット
      ctx.globalAlpha = 1;
      
      // 結果を返す
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageDataUrl;
  });
}

// 商用利用マークのプリセット
export const COMMERCIAL_WATERMARK_PRESETS = {
  subtle: {
    text: 'COMMERCIAL',
    fontSize: 12,
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    position: 'bottom-right' as const,
    opacity: 0.8,
    padding: 8
  },
  bold: {
    text: 'COMMERCIAL USE',
    fontSize: 16,
    color: '#ffffff',
    backgroundColor: 'rgba(220, 38, 38, 0.8)',
    position: 'bottom-right' as const,
    opacity: 1,
    padding: 12
  },
  center: {
    text: 'COMMERCIAL',
    fontSize: 24,
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    position: 'center' as const,
    opacity: 0.7,
    padding: 16
  },
  minimal: {
    text: 'C',
    fontSize: 14,
    color: '#ffffff',
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
    position: 'bottom-right' as const,
    opacity: 0.9,
    padding: 6
  }
};

// 画像サイズを変更する関数
export function resizeImage(
  imageDataUrl: string, 
  targetWidth: number, 
  targetHeight: number,
  quality: number = 0.9
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      // 画像を描画（リサイズ）
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageDataUrl;
  });
}

// 画像の明度を調整する関数
export function adjustImageBrightness(
  imageDataUrl: string, 
  brightness: number // -100 to 100
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      // 明度フィルターを適用
      ctx.filter = `brightness(${100 + brightness}%)`;
      ctx.drawImage(img, 0, 0);
      
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageDataUrl;
  });
}

// Base64からBlobに変換
export function base64ToBlob(base64: string, mimeType: string = 'image/png'): Blob {
  const byteCharacters = atob(base64.split(',')[1]);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// 画像をダウンロードする関数
export function downloadImage(imageDataUrl: string, filename: string = 'generated-image.png'): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = imageDataUrl;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 商用利用マーク付き画像のファイル名を生成
export function generateCommercialFilename(originalPrompt: string, timestamp?: string): string {
  const cleanPrompt = originalPrompt
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 30);
  
  const time = timestamp || new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  
  return `commercial-${cleanPrompt}-${time}.png`;
}