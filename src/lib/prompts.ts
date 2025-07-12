'use client';

// プロンプトカテゴリの定義
export type PromptCategory = 'character' | 'clothing' | 'background' | 'lighting';

export interface CategorizedPrompt {
  id?: string;
  user_id: string;
  category: PromptCategory;
  name: string;
  content: string;
  description?: string;
  tags?: string[];
  is_public?: boolean;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PromptCombination {
  id?: string;
  user_id: string;
  name: string;
  description?: string;
  character_prompt_id?: string;
  clothing_prompt_id?: string;
  background_prompt_id?: string;
  lighting_prompt_id?: string;
  combined_prompt?: string; // 最終的な結合プロンプト
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
}

// カテゴリの日本語名とアイコン
export const PROMPT_CATEGORIES = {
  character: {
    name: 'キャラクター（人物）',
    icon: '👤',
    description: 'キャラクターの外見、性別、年齢、表情など',
    placeholder: '美しい女性、笑顔、青い瞳...'
  },
  clothing: {
    name: '衣装・服装',
    icon: '👗',
    description: '服装、アクセサリー、装身具など',
    placeholder: '和服、着物、金色の帯...'
  },
  background: {
    name: '背景・シーン',
    icon: '🏞️',
    description: '背景、場所、環境、シーンなど',
    placeholder: '和室、畳、障子、桜...'
  },
  lighting: {
    name: '光・スタイル',
    icon: '💡',
    description: '照明、雰囲気、芸術スタイルなど',
    placeholder: 'シネマティック、ソフトライト、映画風...'
  }
} as const;

// デフォルトプロンプトデータ
const DEFAULT_PROMPTS: CategorizedPrompt[] = [
  // キャラクター
  {
    id: 'char_1',
    user_id: 'guest',
    category: 'character',
    name: '美しい女性',
    content: 'beautiful woman, elegant face, gentle smile, bright eyes',
    description: '上品で美しい女性キャラクター',
    tags: ['女性', '美しい', '上品'],
    is_public: true,
    usage_count: 15,
    created_at: '2024-06-20T10:00:00Z'
  },
  {
    id: 'char_2',
    user_id: 'guest',
    category: 'character',
    name: 'かっこいい男性',
    content: 'handsome man, strong jawline, confident expression, sharp eyes',
    description: '凛々しくハンサムな男性キャラクター',
    tags: ['男性', 'ハンサム', '凛々しい'],
    is_public: true,
    usage_count: 8,
    created_at: '2024-06-18T14:30:00Z'
  },
  {
    id: 'char_3',
    user_id: 'guest',
    category: 'character',
    name: '可愛い少女',
    content: 'cute girl, innocent face, big eyes, cheerful smile',
    description: '元気で可愛らしい少女キャラクター',
    tags: ['少女', '可愛い', '元気'],
    is_public: true,
    usage_count: 12,
    created_at: '2024-06-15T09:15:00Z'
  },

  // 衣装・服装
  {
    id: 'cloth_1',
    user_id: 'guest',
    category: 'clothing',
    name: '和服・着物',
    content: 'traditional Japanese kimono, elegant obi belt, delicate patterns',
    description: '伝統的な日本の着物',
    tags: ['和服', '着物', '伝統'],
    is_public: true,
    usage_count: 20,
    created_at: '2024-06-22T11:00:00Z'
  },
  {
    id: 'cloth_2',
    user_id: 'guest',
    category: 'clothing',
    name: 'ドレス',
    content: 'elegant evening dress, flowing fabric, sophisticated design',
    description: '上品なイブニングドレス',
    tags: ['ドレス', '上品', 'フォーマル'],
    is_public: true,
    usage_count: 18,
    created_at: '2024-06-20T16:45:00Z'
  },
  {
    id: 'cloth_3',
    user_id: 'guest',
    category: 'clothing',
    name: 'カジュアル',
    content: 'casual outfit, comfortable jeans, stylish t-shirt',
    description: 'おしゃれなカジュアル服',
    tags: ['カジュアル', 'ジーンズ', 'おしゃれ'],
    is_public: true,
    usage_count: 10,
    created_at: '2024-06-19T13:20:00Z'
  },

  // 背景・シーン
  {
    id: 'bg_1',
    user_id: 'guest',
    category: 'background',
    name: '和室',
    content: 'traditional Japanese room, tatami mats, shoji screens, cherry blossoms visible outside',
    description: '伝統的な日本の和室',
    tags: ['和室', '畳', '障子', '桜'],
    is_public: true,
    usage_count: 25,
    created_at: '2024-06-21T08:30:00Z'
  },
  {
    id: 'bg_2',
    user_id: 'guest',
    category: 'background',
    name: 'スタジオ',
    content: 'professional studio background, clean white backdrop, minimal setup',
    description: 'プロフェッショナルなスタジオ背景',
    tags: ['スタジオ', '白背景', 'シンプル'],
    is_public: true,
    usage_count: 30,
    created_at: '2024-06-20T12:00:00Z'
  },
  {
    id: 'bg_3',
    user_id: 'guest',
    category: 'background',
    name: '自然・公園',
    content: 'beautiful park setting, green trees, natural sunlight, peaceful atmosphere',
    description: '美しい自然の公園',
    tags: ['自然', '公園', '緑', '平和'],
    is_public: true,
    usage_count: 22,
    created_at: '2024-06-18T15:45:00Z'
  },

  // 光・スタイル
  {
    id: 'light_1',
    user_id: 'guest',
    category: 'lighting',
    name: 'シネマティック',
    content: 'cinematic lighting, dramatic shadows, film photography style, high contrast',
    description: '映画のようなドラマチックな照明',
    tags: ['シネマ', '映画', 'ドラマチック'],
    is_public: true,
    usage_count: 35,
    created_at: '2024-06-23T10:15:00Z'
  },
  {
    id: 'light_2',
    user_id: 'guest',
    category: 'lighting',
    name: 'ソフトライト',
    content: 'soft natural lighting, gentle shadows, warm atmosphere, portrait photography',
    description: '優しく自然な照明',
    tags: ['ソフト', '自然', '暖かい'],
    is_public: true,
    usage_count: 28,
    created_at: '2024-06-21T14:20:00Z'
  },
  {
    id: 'light_3',
    user_id: 'guest',
    category: 'lighting',
    name: 'アニメ風',
    content: 'anime style, cel-shading, vibrant colors, clean lines, kawaii aesthetic',
    description: 'アニメ・漫画風のスタイル',
    tags: ['アニメ', 'セルシェーディング', '鮮やか'],
    is_public: true,
    usage_count: 40,
    created_at: '2024-06-19T11:30:00Z'
  }
];

const PROMPTS_STORAGE_KEY = 'ai-pose-editor-categorized-prompts';
const COMBINATIONS_STORAGE_KEY = 'ai-pose-editor-prompt-combinations';

// プロンプトをカテゴリで取得
export function getPromptsByCategory(category: PromptCategory): CategorizedPrompt[] {
  const allPrompts = getGuestPrompts();
  return allPrompts.filter(prompt => prompt.category === category);
}

// 全てのゲストプロンプトを取得
export function getGuestPrompts(): CategorizedPrompt[] {
  if (typeof window === 'undefined') {
    return DEFAULT_PROMPTS;
  }
  
  try {
    const stored = localStorage.getItem(PROMPTS_STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(DEFAULT_PROMPTS));
      return DEFAULT_PROMPTS;
    }
    
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error reading prompts from localStorage:', error);
    return DEFAULT_PROMPTS;
  }
}

// プロンプトを保存
export function saveGuestPrompt(prompt: Omit<CategorizedPrompt, 'id' | 'created_at' | 'usage_count'>): CategorizedPrompt {
  const prompts = getGuestPrompts();
  
  const newPrompt: CategorizedPrompt = {
    ...prompt,
    id: `${prompt.category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    usage_count: 0,
    created_at: new Date().toISOString()
  };
  
  prompts.unshift(newPrompt);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
  }
  
  return newPrompt;
}

// プロンプトを削除
export function deleteGuestPrompt(promptId: string): boolean {
  const prompts = getGuestPrompts();
  const updatedPrompts = prompts.filter(prompt => prompt.id !== promptId);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(updatedPrompts));
  }
  
  return prompts.length !== updatedPrompts.length;
}

// プロンプトの使用回数をインクリメント
export function incrementPromptUsage(promptId: string): void {
  const prompts = getGuestPrompts();
  const updatedPrompts = prompts.map(prompt => {
    if (prompt.id === promptId) {
      return {
        ...prompt,
        usage_count: (prompt.usage_count || 0) + 1,
        updated_at: new Date().toISOString()
      };
    }
    return prompt;
  });
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(updatedPrompts));
  }
}

// プロンプト組み合わせの取得
export function getPromptCombinations(): PromptCombination[] {
  if (typeof window === 'undefined') {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(COMBINATIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading combinations from localStorage:', error);
    return [];
  }
}

// プロンプト組み合わせを保存
export function savePromptCombination(combination: Omit<PromptCombination, 'id' | 'created_at' | 'usage_count'>): PromptCombination {
  const combinations = getPromptCombinations();
  
  const newCombination: PromptCombination = {
    ...combination,
    id: `combo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    usage_count: 0,
    created_at: new Date().toISOString()
  };
  
  combinations.unshift(newCombination);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(COMBINATIONS_STORAGE_KEY, JSON.stringify(combinations));
  }
  
  return newCombination;
}

// プロンプト組み合わせを削除
export function deletePromptCombination(combinationId: string): boolean {
  const combinations = getPromptCombinations();
  const updatedCombinations = combinations.filter(combo => combo.id !== combinationId);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(COMBINATIONS_STORAGE_KEY, JSON.stringify(updatedCombinations));
  }
  
  return combinations.length !== updatedCombinations.length;
}

// プロンプトIDから内容を取得
export function getPromptById(promptId: string): CategorizedPrompt | undefined {
  const prompts = getGuestPrompts();
  return prompts.find(prompt => prompt.id === promptId);
}

// プロンプトを組み合わせて最終プロンプトを生成
export function generateCombinedPrompt(
  characterId?: string,
  clothingId?: string,
  backgroundId?: string,
  lightingId?: string
): string {
  const parts: string[] = [];
  
  if (characterId) {
    const character = getPromptById(characterId);
    if (character) parts.push(character.content);
  }
  
  if (clothingId) {
    const clothing = getPromptById(clothingId);
    if (clothing) parts.push(clothing.content);
  }
  
  if (backgroundId) {
    const background = getPromptById(backgroundId);
    if (background) parts.push(background.content);
  }
  
  if (lightingId) {
    const lighting = getPromptById(lightingId);
    if (lighting) parts.push(lighting.content);
  }
  
  return parts.join(', ');
}

// プロンプトを検索
export function searchPrompts(prompts: CategorizedPrompt[], keyword: string): CategorizedPrompt[] {
  const lowerKeyword = keyword.toLowerCase();
  
  return prompts.filter(prompt => 
    prompt.name.toLowerCase().includes(lowerKeyword) ||
    prompt.content.toLowerCase().includes(lowerKeyword) ||
    prompt.description?.toLowerCase().includes(lowerKeyword) ||
    prompt.tags?.some(tag => tag.toLowerCase().includes(lowerKeyword))
  );
}

// 人気プロンプトを取得
export function getPopularPrompts(category?: PromptCategory, limit: number = 5): CategorizedPrompt[] {
  let prompts = getGuestPrompts();
  
  if (category) {
    prompts = prompts.filter(prompt => prompt.category === category);
  }
  
  return prompts
    .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
    .slice(0, limit);
}

// プロンプト統計を取得
export function getPromptStats(): {
  totalPrompts: number;
  promptsByCategory: Record<PromptCategory, number>;
  totalCombinations: number;
  mostUsedPrompt?: CategorizedPrompt;
} {
  const prompts = getGuestPrompts();
  const combinations = getPromptCombinations();
  
  const promptsByCategory = prompts.reduce((acc, prompt) => {
    acc[prompt.category] = (acc[prompt.category] || 0) + 1;
    return acc;
  }, {} as Record<PromptCategory, number>);
  
  // 各カテゴリのデフォルト値を設定
  Object.keys(PROMPT_CATEGORIES).forEach(category => {
    if (!promptsByCategory[category as PromptCategory]) {
      promptsByCategory[category as PromptCategory] = 0;
    }
  });
  
  const mostUsedPrompt = prompts.reduce((prev, current) => 
    (current.usage_count || 0) > (prev?.usage_count || 0) ? current : prev
  , undefined as CategorizedPrompt | undefined);
  
  return {
    totalPrompts: prompts.length,
    promptsByCategory,
    totalCombinations: combinations.length,
    mostUsedPrompt
  };
}