'use client';

// AI画像スタイルの定義
export interface AIStyle {
  id: string;
  name: string;
  description: string;
  promptTag: string; // プロンプトに挿入されるタグ
  preview: string; // プレビュー用の説明テキスト
  category: 'realistic' | 'artistic' | 'anime' | 'fantasy' | 'vintage' | 'experimental';
  isPremium: boolean;
  releaseDate: string; // YYYY-MM形式
  examples: string[]; // 使用例のプロンプト
  thumbnail?: string; // サムネイル画像（オプション）
  color: string; // UIでの表示色
  isNew?: boolean; // 新着スタイル
}

// 月替わりスタイルのデータ
export const AI_STYLES: AIStyle[] = [
  // 基本スタイル（無料）
  {
    id: 'basic_realistic',
    name: 'スタンダード・リアル',
    description: '自然で写実的な画像スタイル',
    promptTag: '<style:realistic>',
    preview: '高品質な写真のような仕上がり',
    category: 'realistic',
    isPremium: false,
    releaseDate: '2024-01',
    examples: [
      'beautiful portrait photography',
      'natural lighting, high resolution',
      'professional photo style'
    ],
    color: '#3B82F6',
    thumbnail: '📸'
  },
  {
    id: 'basic_anime',
    name: 'ベーシック・アニメ',
    description: '基本的なアニメ調スタイル',
    promptTag: '<style:anime>',
    preview: 'シンプルなアニメ風イラスト',
    category: 'anime',
    isPremium: false,
    releaseDate: '2024-01',
    examples: [
      'anime style illustration',
      'cel shading, clean lines',
      'colorful anime art'
    ],
    color: '#EC4899',
    thumbnail: '🎨'
  },

  // プレミアムスタイル（月替わり）
  {
    id: 'premium_watercolor_2024_01',
    name: '水彩アクアレル',
    description: '透明感のある美しい水彩画スタイル',
    promptTag: '<style:watercolor_delicate>',
    preview: '柔らかい色合いと自然なにじみが特徴',
    category: 'artistic',
    isPremium: true,
    releaseDate: '2024-01',
    examples: [
      'delicate watercolor painting',
      'soft colors, paper texture',
      'artistic watercolor illustration'
    ],
    color: '#06B6D4',
    thumbnail: '🎨',
    isNew: false
  },
  {
    id: 'premium_cyberpunk_2024_02',
    name: 'ネオン・サイバーパンク',
    description: '近未来的でネオンが映える都市スタイル',
    promptTag: '<style:cyberpunk_neon>',
    preview: '鮮やかなネオンと暗い背景のコントラスト',
    category: 'fantasy',
    isPremium: true,
    releaseDate: '2024-02',
    examples: [
      'cyberpunk neon lighting',
      'futuristic city atmosphere',
      'electric blue and pink tones'
    ],
    color: '#8B5CF6',
    thumbnail: '🌃',
    isNew: false
  },
  {
    id: 'premium_oilpainting_2024_03',
    name: 'クラシック油彩',
    description: '重厚で格調高い油絵スタイル',
    promptTag: '<style:classical_oil_painting>',
    preview: '伝統的な油絵の質感と深い色合い',
    category: 'artistic',
    isPremium: true,
    releaseDate: '2024-03',
    examples: [
      'classical oil painting style',
      'rich textures, deep colors',
      'renaissance art technique'
    ],
    color: '#D97706',
    thumbnail: '🖼️',
    isNew: false
  },
  {
    id: 'premium_pastel_2024_04',
    name: 'ドリーミー・パステル',
    description: '夢のような優しいパステルカラー',
    promptTag: '<style:dreamy_pastel>',
    preview: '淡く美しい色彩で包み込むような雰囲気',
    category: 'artistic',
    isPremium: true,
    releaseDate: '2024-04',
    examples: [
      'soft pastel colors',
      'dreamy atmosphere',
      'gentle lighting effects'
    ],
    color: '#F472B6',
    thumbnail: '🌸',
    isNew: false
  },
  {
    id: 'premium_vintage_2024_05',
    name: 'レトロ・フィルム',
    description: 'ノスタルジックなフィルム写真風',
    promptTag: '<style:vintage_film>',
    preview: '懐かしいフィルムカメラの質感',
    category: 'vintage',
    isPremium: true,
    releaseDate: '2024-05',
    examples: [
      'vintage film photography',
      'analog camera aesthetic',
      'nostalgic color grading'
    ],
    color: '#92400E',
    thumbnail: '📷',
    isNew: false
  },
  {
    id: 'premium_sketch_2024_06',
    name: 'アーティスト・スケッチ',
    description: '手描きスケッチのような繊細なタッチ',
    promptTag: '<style:artist_sketch>',
    preview: '鉛筆やペンで描いたような線画',
    category: 'artistic',
    isPremium: true,
    releaseDate: '2024-06',
    examples: [
      'detailed pencil sketch',
      'artistic line drawing',
      'hand-drawn illustration'
    ],
    color: '#374151',
    thumbnail: '✏️',
    isNew: false
  },
  {
    id: 'premium_fantasy_2024_07',
    name: 'ミスティック・ファンタジー',
    description: '神秘的で幻想的な世界観',
    promptTag: '<style:mystical_fantasy>',
    preview: '魔法的な光と不思議な雰囲気',
    category: 'fantasy',
    isPremium: true,
    releaseDate: '2024-07',
    examples: [
      'mystical fantasy art',
      'magical lighting effects',
      'ethereal atmosphere'
    ],
    color: '#7C3AED',
    thumbnail: '🔮',
    isNew: true
  },
  {
    id: 'premium_minimalist_2024_08',
    name: 'モダン・ミニマル',
    description: 'シンプルで洗練されたミニマルスタイル',
    promptTag: '<style:modern_minimalist>',
    preview: '余白を活かした現代的なデザイン',
    category: 'artistic',
    isPremium: true,
    releaseDate: '2024-08',
    examples: [
      'minimalist design',
      'clean composition',
      'modern aesthetic'
    ],
    color: '#059669',
    thumbnail: '⭕',
    isNew: true
  },
  {
    id: 'premium_impressionist_2024_09',
    name: 'インプレッショニスト',
    description: '印象派絵画のような光と色彩',
    promptTag: '<style:impressionist>',
    preview: '光の表現を重視した印象派風',
    category: 'artistic',
    isPremium: true,
    releaseDate: '2024-09',
    examples: [
      'impressionist painting style',
      'play of light and shadow',
      'visible brushstrokes'
    ],
    color: '#F59E0B',
    thumbnail: '🌅',
    isNew: true
  },
  {
    id: 'premium_gothic_2024_10',
    name: 'ダーク・ゴシック',
    description: '重厚で神秘的なゴシック様式',
    promptTag: '<style:dark_gothic>',
    preview: '荘厳で暗い美しさを表現',
    category: 'fantasy',
    isPremium: true,
    releaseDate: '2024-10',
    examples: [
      'gothic architecture style',
      'dark atmospheric mood',
      'dramatic lighting'
    ],
    color: '#1F2937',
    thumbnail: '🏰',
    isNew: true
  },
  {
    id: 'premium_pixelart_2024_11',
    name: 'レトロ・ピクセル',
    description: '8bit・16bit風のピクセルアート',
    promptTag: '<style:retro_pixel>',
    preview: 'ノスタルジックなゲーム風グラフィック',
    category: 'experimental',
    isPremium: true,
    releaseDate: '2024-11',
    examples: [
      '8-bit pixel art style',
      'retro game graphics',
      'pixelated illustration'
    ],
    color: '#DC2626',
    thumbnail: '🕹️',
    isNew: true
  },
  {
    id: 'premium_holographic_2024_12',
    name: 'ホログラフィック',
    description: '虹色に輝く未来的なホログラム風',
    promptTag: '<style:holographic>',
    preview: '光の屈折による幻想的な表現',
    category: 'experimental',
    isPremium: true,
    releaseDate: '2024-12',
    examples: [
      'holographic effect',
      'iridescent colors',
      'futuristic light refraction'
    ],
    color: '#6366F1',
    thumbnail: '🌈',
    isNew: true
  }
];

// 現在の年月を取得
function getCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// 利用可能なスタイルを取得（リリース日によるフィルター）
export function getAvailableStyles(): AIStyle[] {
  const currentYearMonth = getCurrentYearMonth();
  
  return AI_STYLES.filter(style => {
    // 無料スタイルは常に利用可能
    if (!style.isPremium) return true;
    
    // プレミアムスタイルはリリース日以降に利用可能
    return style.releaseDate <= currentYearMonth;
  });
}

// プレミアム限定スタイルを取得
export function getPremiumStyles(): AIStyle[] {
  return getAvailableStyles().filter(style => style.isPremium);
}

// 無料スタイルを取得
export function getFreeStyles(): AIStyle[] {
  return AI_STYLES.filter(style => !style.isPremium);
}

// カテゴリ別にスタイルを取得
export function getStylesByCategory(category: AIStyle['category']): AIStyle[] {
  return getAvailableStyles().filter(style => style.category === category);
}

// 新着スタイルを取得
export function getNewStyles(): AIStyle[] {
  return getAvailableStyles().filter(style => style.isNew);
}

// IDでスタイルを取得
export function getStyleById(id: string): AIStyle | undefined {
  return AI_STYLES.find(style => style.id === id);
}

// 今月の新スタイルを取得
export function getThisMonthStyle(): AIStyle | undefined {
  const currentYearMonth = getCurrentYearMonth();
  return AI_STYLES.find(style => 
    style.isPremium && 
    style.releaseDate === currentYearMonth
  );
}

// プロンプトにスタイルタグを適用
export function applyStyleToPrompt(basePrompt: string, styleId: string): string {
  const style = getStyleById(styleId);
  if (!style) return basePrompt;
  
  // スタイルタグをプロンプトの先頭に追加
  return `${style.promptTag} ${basePrompt}`;
}

// ユーザーがスタイルにアクセス可能かチェック
export function canUserAccessStyle(styleId: string, isPremiumUser: boolean): boolean {
  const style = getStyleById(styleId);
  if (!style) return false;
  
  // 無料スタイルは誰でもアクセス可能
  if (!style.isPremium) return true;
  
  // プレミアムスタイルは有料ユーザーのみ
  return isPremiumUser;
}

// スタイルカテゴリの情報
export const STYLE_CATEGORIES = {
  realistic: {
    name: '写実的',
    description: '現実的で自然な画像スタイル',
    icon: '📸',
    color: '#3B82F6'
  },
  artistic: {
    name: 'アート系',
    description: '芸術的で創造的なスタイル',
    icon: '🎨',
    color: '#EC4899'
  },
  anime: {
    name: 'アニメ・漫画',
    description: '日本のアニメ・漫画風スタイル',
    icon: '🎌',
    color: '#F59E0B'
  },
  fantasy: {
    name: 'ファンタジー',
    description: '幻想的で非現実的なスタイル',
    icon: '🔮',
    color: '#8B5CF6'
  },
  vintage: {
    name: 'ビンテージ',
    description: '懐かしい雰囲気のレトロスタイル',
    icon: '📷',
    color: '#92400E'
  },
  experimental: {
    name: '実験的',
    description: '革新的で独特なスタイル',
    icon: '🧪',
    color: '#059669'
  }
} as const;

// スタイル使用統計（ローカルストレージ）
const STYLE_USAGE_KEY = 'ai-pose-editor-style-usage';

interface StyleUsage {
  [styleId: string]: {
    count: number;
    lastUsed: string;
  };
}

// スタイル使用回数を記録
export function recordStyleUsage(styleId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem(STYLE_USAGE_KEY);
    const usage: StyleUsage = stored ? JSON.parse(stored) : {};
    
    if (!usage[styleId]) {
      usage[styleId] = { count: 0, lastUsed: '' };
    }
    
    usage[styleId].count++;
    usage[styleId].lastUsed = new Date().toISOString();
    
    localStorage.setItem(STYLE_USAGE_KEY, JSON.stringify(usage));
  } catch (error) {
    console.error('Error recording style usage:', error);
  }
}

// 人気スタイルを取得
export function getPopularStyles(limit: number = 5): AIStyle[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STYLE_USAGE_KEY);
    const usage: StyleUsage = stored ? JSON.parse(stored) : {};
    
    const availableStyles = getAvailableStyles();
    
    return availableStyles
      .map(style => ({
        ...style,
        usageCount: usage[style.id]?.count || 0
      }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting popular styles:', error);
    return [];
  }
}

// 最近使用したスタイルを取得
export function getRecentStyles(limit: number = 3): AIStyle[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STYLE_USAGE_KEY);
    const usage: StyleUsage = stored ? JSON.parse(stored) : {};
    
    const availableStyles = getAvailableStyles();
    
    return availableStyles
      .filter(style => usage[style.id]?.lastUsed)
      .sort((a, b) => {
        const aLastUsed = usage[a.id]?.lastUsed || '';
        const bLastUsed = usage[b.id]?.lastUsed || '';
        return bLastUsed.localeCompare(aLastUsed);
      })
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting recent styles:', error);
    return [];
  }
}