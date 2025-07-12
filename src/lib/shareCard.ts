'use client';

export interface ShareCardOptions {
  generatedImage: string; // Base64 画像
  prompt: string;
  poseData?: any;
  style?: string;
  background?: string;
  isCommercial?: boolean;
  userName?: string;
  layout?: 'horizontal' | 'vertical' | 'square';
  theme?: 'light' | 'dark' | 'gradient';
}

export interface ShareCardTemplate {
  name: string;
  description: string;
  width: number;
  height: number;
  layout: 'horizontal' | 'vertical' | 'square';
  theme: 'light' | 'dark' | 'gradient';
}

// 利用可能なテンプレート
export const SHARE_CARD_TEMPLATES: Record<string, ShareCardTemplate> = {
  twitter: {
    name: 'Twitter Card',
    description: 'Twitter用の横長カード',
    width: 640,
    height: 320,
    layout: 'horizontal',
    theme: 'light'
  },
  instagram: {
    name: 'Instagram Square',
    description: 'Instagram用の正方形カード',
    width: 600,
    height: 600,
    layout: 'square',
    theme: 'gradient'
  },
  facebook: {
    name: 'Facebook Card',
    description: 'Facebook用のカード',
    width: 630,
    height: 330,
    layout: 'horizontal',
    theme: 'light'
  },
  discord: {
    name: 'Discord Embed',
    description: 'Discord用の縦長カード',
    width: 400,
    height: 600,
    layout: 'vertical',
    theme: 'dark'
  }
};

// ポーズデータからサムネイル用のSVGを生成
function generatePoseThumbnail(poseData: any, size: number = 80): string {
  if (!poseData || !poseData.keypoints) {
    return generateDefaultPoseSVG(size);
  }

  const keypoints = Array.isArray(poseData.keypoints) ? poseData.keypoints : [];
  if (keypoints.length === 0) {
    return generateDefaultPoseSVG(size);
  }

  // SVGの作成
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="poseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <!-- 背景 -->
      <rect width="100" height="100" fill="#F8FAFC" rx="8"/>
      
      <!-- 骨格線 -->
      <g stroke="url(#poseGradient)" stroke-width="2" fill="none">
        ${generateSkeletonLines(keypoints)}
      </g>
      
      <!-- キーポイント -->
      <g fill="url(#poseGradient)">
        ${generateKeypointCircles(keypoints)}
      </g>
      
      <!-- タイトル -->
      <text x="50" y="15" text-anchor="middle" fill="#1F2937" font-family="Arial" font-size="8" font-weight="bold">POSE</text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function generateDefaultPoseSVG(size: number): string {
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#F3F4F6" rx="8"/>
      <text x="50" y="55" text-anchor="middle" fill="#9CA3AF" font-family="Arial" font-size="12">🤖</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function generateSkeletonLines(keypoints: any[]): string {
  const connections = [
    ['left_shoulder', 'right_shoulder'],
    ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_wrist'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_wrist'],
    ['left_shoulder', 'left_hip'],
    ['right_shoulder', 'right_hip'],
    ['left_hip', 'right_hip'],
    ['left_hip', 'left_knee'],
    ['left_knee', 'left_ankle'],
    ['right_hip', 'right_knee'],
    ['right_knee', 'right_ankle'],
  ];

  return connections.map(([start, end]) => {
    const startPoint = keypoints.find(p => p.name === start);
    const endPoint = keypoints.find(p => p.name === end);
    
    if (startPoint && endPoint) {
      const x1 = (startPoint.x || 0.5) * 100;
      const y1 = (startPoint.y || 0.5) * 100;
      const x2 = (endPoint.x || 0.5) * 100;
      const y2 = (endPoint.y || 0.5) * 100;
      
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
    }
    return '';
  }).join('');
}

function generateKeypointCircles(keypoints: any[]): string {
  return keypoints.map((point, index) => {
    const x = (point.x || 0.5) * 100;
    const y = (point.y || 0.5) * 100;
    return `<circle cx="${x}" cy="${y}" r="2" />`;
  }).join('');
}

// プロンプトを適切な長さに切り詰める
function truncatePrompt(prompt: string, maxLength: number = 80): string {
  if (prompt.length <= maxLength) return prompt;
  
  const truncated = prompt.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

// テーマ別の色設定
function getThemeColors(theme: 'light' | 'dark' | 'gradient') {
  switch (theme) {
    case 'light':
      return {
        background: '#FFFFFF',
        primary: '#1F2937',
        secondary: '#6B7280',
        accent: '#3B82F6',
        border: '#E5E7EB'
      };
    case 'dark':
      return {
        background: '#1F2937',
        primary: '#FFFFFF',
        secondary: '#D1D5DB',
        accent: '#60A5FA',
        border: '#374151'
      };
    case 'gradient':
      return {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        primary: '#FFFFFF',
        secondary: '#F3F4F6',
        accent: '#FCD34D',
        border: 'rgba(255,255,255,0.2)'
      };
  }
}

// メインのシェアカード生成関数
export async function generateShareCard(options: ShareCardOptions): Promise<string> {
  const {
    generatedImage,
    prompt,
    poseData,
    style = 'AI Generated',
    background = '',
    isCommercial = false,
    userName = 'Anonymous',
    layout = 'horizontal',
    theme = 'light'
  } = options;

  // テンプレート選択（デフォルトはTwitter）
  const template = layout === 'square' ? SHARE_CARD_TEMPLATES.instagram : 
                   layout === 'vertical' ? SHARE_CARD_TEMPLATES.discord :
                   SHARE_CARD_TEMPLATES.twitter;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  canvas.width = template.width;
  canvas.height = template.height;

  const colors = getThemeColors(theme);

  // 背景の描画
  if (theme === 'gradient') {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = colors.background;
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // レイアウトに応じた描画
  if (layout === 'horizontal') {
    await drawHorizontalLayout(ctx, template, colors, options);
  } else if (layout === 'vertical') {
    await drawVerticalLayout(ctx, template, colors, options);
  } else {
    await drawSquareLayout(ctx, template, colors, options);
  }

  return canvas.toDataURL('image/png');
}

// 横長レイアウト（Twitter/Facebook）
async function drawHorizontalLayout(
  ctx: CanvasRenderingContext2D, 
  template: ShareCardTemplate, 
  colors: any, 
  options: ShareCardOptions
) {
  const { width, height } = template;
  const { generatedImage, prompt, poseData, style, isCommercial } = options;

  // 画像エリア（左側）
  const imageSize = height - 40;
  const imageX = 20;
  const imageY = 20;

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = generatedImage;
    });

    // 画像を角丸で描画
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(imageX, imageY, imageSize, imageSize, 12);
    ctx.clip();
    ctx.drawImage(img, imageX, imageY, imageSize, imageSize);
    ctx.restore();

    // 商用マーク
    if (isCommercial) {
      ctx.fillStyle = 'rgba(147, 51, 234, 0.9)';
      ctx.fillRect(imageX + imageSize - 60, imageY + 8, 52, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('COMMERCIAL', imageX + imageSize - 34, imageY + 20);
    }
  } catch (error) {
    // 画像読み込み失敗時のフォールバック
    ctx.fillStyle = colors.border;
    ctx.fillRect(imageX, imageY, imageSize, imageSize);
    ctx.fillStyle = colors.secondary;
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🖼️', imageX + imageSize/2, imageY + imageSize/2 + 8);
  }

  // テキストエリア（右側）
  const textX = imageX + imageSize + 30;
  const textWidth = width - textX - 20;
  let currentY = 50;

  // タイトル
  ctx.fillStyle = colors.primary;
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('AI Pose Editor', textX, currentY);
  currentY += 35;

  // プロンプト
  ctx.fillStyle = colors.secondary;
  ctx.font = '14px Arial';
  const truncatedPrompt = truncatePrompt(prompt, 120);
  const words = truncatedPrompt.split(' ');
  let line = '';
  
  words.forEach((word, i) => {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > textWidth && i > 0) {
      ctx.fillText(line, textX, currentY);
      line = word + ' ';
      currentY += 20;
    } else {
      line = testLine;
    }
  });
  ctx.fillText(line, textX, currentY);
  currentY += 30;

  // メタ情報
  ctx.fillStyle = colors.accent;
  ctx.font = '12px Arial';
  ctx.fillText(`Style: ${style}`, textX, currentY);
  currentY += 18;

  // ポーズサムネイル
  if (poseData) {
    const poseThumbnailSrc = generatePoseThumbnail(poseData, 60);
    try {
      const poseImg = new Image();
      await new Promise((resolve, reject) => {
        poseImg.onload = resolve;
        poseImg.onerror = reject;
        poseImg.src = poseThumbnailSrc;
      });
      ctx.drawImage(poseImg, textX, currentY, 60, 60);
    } catch (error) {
      console.error('Failed to load pose thumbnail:', error);
    }
  }

  // ハッシュタグ
  ctx.fillStyle = colors.accent;
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('#PoseCrafterで作った #AI画像生成', width - 20, height - 20);

  // ブランドロゴ/ウォーターマーク
  ctx.fillStyle = colors.secondary;
  ctx.font = '10px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Generated with AI Pose Editor', textX, height - 20);
}

// 縦長レイアウト（Discord）
async function drawVerticalLayout(
  ctx: CanvasRenderingContext2D, 
  template: ShareCardTemplate, 
  colors: any, 
  options: ShareCardOptions
) {
  const { width, height } = template;
  const { generatedImage, prompt, poseData, style, isCommercial } = options;

  let currentY = 30;

  // ヘッダー
  ctx.fillStyle = colors.primary;
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('AI Pose Editor', width/2, currentY);
  currentY += 40;

  // 画像エリア
  const imageSize = width - 60;
  const imageX = 30;

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = generatedImage;
    });

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(imageX, currentY, imageSize, imageSize, 12);
    ctx.clip();
    ctx.drawImage(img, imageX, currentY, imageSize, imageSize);
    ctx.restore();

    if (isCommercial) {
      ctx.fillStyle = 'rgba(147, 51, 234, 0.9)';
      ctx.fillRect(imageX + imageSize - 80, currentY + 12, 68, 24);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('COMMERCIAL', imageX + imageSize - 46, currentY + 28);
    }
  } catch (error) {
    ctx.fillStyle = colors.border;
    ctx.fillRect(imageX, currentY, imageSize, imageSize);
    ctx.fillStyle = colors.secondary;
    ctx.font = '32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🖼️', width/2, currentY + imageSize/2 + 12);
  }

  currentY += imageSize + 30;

  // プロンプト
  ctx.fillStyle = colors.secondary;
  ctx.font = '13px Arial';
  ctx.textAlign = 'left';
  const truncatedPrompt = truncatePrompt(prompt, 100);
  const words = truncatedPrompt.split(' ');
  let line = '';
  
  words.forEach((word, i) => {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > imageSize && i > 0) {
      ctx.fillText(line, imageX, currentY);
      line = word + ' ';
      currentY += 18;
    } else {
      line = testLine;
    }
  });
  ctx.fillText(line, imageX, currentY);
  currentY += 30;

  // ポーズとメタ情報
  if (poseData) {
    const poseThumbnailSrc = generatePoseThumbnail(poseData, 50);
    try {
      const poseImg = new Image();
      await new Promise((resolve, reject) => {
        poseImg.onload = resolve;
        poseImg.onerror = reject;
        poseImg.src = poseThumbnailSrc;
      });
      ctx.drawImage(poseImg, imageX, currentY, 50, 50);
      
      ctx.fillStyle = colors.accent;
      ctx.font = '12px Arial';
      ctx.fillText(`Style: ${style}`, imageX + 60, currentY + 25);
    } catch (error) {
      console.error('Failed to load pose thumbnail:', error);
    }
  }

  // ハッシュタグ
  ctx.fillStyle = colors.accent;
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('#PoseCrafterで作った #AI画像生成', width/2, height - 30);
}

// 正方形レイアウト（Instagram）
async function drawSquareLayout(
  ctx: CanvasRenderingContext2D, 
  template: ShareCardTemplate, 
  colors: any, 
  options: ShareCardOptions
) {
  const { width, height } = template;
  const { generatedImage, prompt, poseData, style, isCommercial } = options;

  // 画像エリア（上部）
  const imageSize = width - 80;
  const imageX = 40;
  let currentY = 40;

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = generatedImage;
    });

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(imageX, currentY, imageSize, imageSize * 0.7, 12);
    ctx.clip();
    ctx.drawImage(img, imageX, currentY, imageSize, imageSize * 0.7);
    ctx.restore();

    if (isCommercial) {
      ctx.fillStyle = 'rgba(147, 51, 234, 0.9)';
      ctx.fillRect(imageX + imageSize - 90, currentY + 15, 75, 28);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('COMMERCIAL', imageX + imageSize - 52, currentY + 33);
    }
  } catch (error) {
    ctx.fillStyle = colors.border;
    ctx.fillRect(imageX, currentY, imageSize, imageSize * 0.7);
    ctx.fillStyle = colors.secondary;
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🖼️', width/2, currentY + imageSize * 0.35 + 15);
  }

  currentY += imageSize * 0.7 + 30;

  // タイトル
  ctx.fillStyle = colors.primary;
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('AI Pose Editor', width/2, currentY);
  currentY += 35;

  // プロンプト
  ctx.fillStyle = colors.secondary;
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  const truncatedPrompt = truncatePrompt(prompt, 80);
  const words = truncatedPrompt.split(' ');
  let line = '';
  
  words.forEach((word, i) => {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > imageSize && i > 0) {
      ctx.fillText(line, imageX, currentY);
      line = word + ' ';
      currentY += 20;
    } else {
      line = testLine;
    }
  });
  ctx.fillText(line, imageX, currentY);
  currentY += 30;

  // メタ情報とポーズ
  const metaY = currentY;
  ctx.fillStyle = colors.accent;
  ctx.font = '13px Arial';
  ctx.fillText(`Style: ${style}`, imageX, metaY);

  if (poseData) {
    const poseThumbnailSrc = generatePoseThumbnail(poseData, 60);
    try {
      const poseImg = new Image();
      await new Promise((resolve, reject) => {
        poseImg.onload = resolve;
        poseImg.onerror = reject;
        poseImg.src = poseThumbnailSrc;
      });
      ctx.drawImage(poseImg, imageX + imageSize - 60, metaY - 15, 60, 60);
    } catch (error) {
      console.error('Failed to load pose thumbnail:', error);
    }
  }

  // ハッシュタグ
  ctx.fillStyle = colors.accent;
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('#PoseCrafterで作った #AI画像生成', width/2, height - 30);
}

// クリップボードにコピー
export async function copyToClipboard(imageDataUrl: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.write) {
      // Clipboard API を使用
      const blob = await (await fetch(imageDataUrl)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      return true;
    } else {
      // フォールバック: テキストとしてコピー
      await navigator.clipboard.writeText('AI Pose Editorで作成した画像 #PoseCrafterで作った #AI画像生成');
      return false; // 画像ではなくテキストをコピー
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

// シェアカード用のダウンロード
export function downloadShareCard(imageDataUrl: string, prompt: string): void {
  const link = document.createElement('a');
  
  // ファイル名を生成
  const cleanPrompt = prompt
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 20);
  
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  link.download = `share-card-${cleanPrompt}-${timestamp}.png`;
  link.href = imageDataUrl;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}