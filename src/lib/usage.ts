'use client';

// ゲストユーザー用のlocalStorageベースの使用回数管理

export interface GuestUsage {
  date: string; // YYYY-MM-DD
  imageGeneration: number;
  poseExtraction: number;
  commercialUse: number;
}

export interface UsageLimits {
  imageGeneration: number;
  poseExtraction: number;
  commercialUse: number;
}

export const DEFAULT_GUEST_LIMITS: UsageLimits = {
  imageGeneration: 10,
  poseExtraction: 5,
  commercialUse: 2,
};

const STORAGE_KEY = 'ai-pose-editor-guest-usage';

// 今日の日付をYYYY-MM-DD形式で取得
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// localStorageから使用回数を取得
export function getGuestUsageToday(): GuestUsage {
  if (typeof window === 'undefined') {
    // SSR環境ではデフォルト値を返す
    return {
      date: getTodayString(),
      imageGeneration: 0,
      poseExtraction: 0,
      commercialUse: 0,
    };
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return initializeGuestUsage();
    }
    
    const usage: GuestUsage = JSON.parse(stored);
    const today = getTodayString();
    
    // 日付が変わっていたらリセット
    if (usage.date !== today) {
      return initializeGuestUsage();
    }
    
    return usage;
  } catch (error) {
    console.error('Error reading guest usage from localStorage:', error);
    return initializeGuestUsage();
  }
}

// ゲスト使用回数を初期化
function initializeGuestUsage(): GuestUsage {
  const usage: GuestUsage = {
    date: getTodayString(),
    imageGeneration: 0,
    poseExtraction: 0,
    commercialUse: 0,
  };
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  }
  
  return usage;
}

// localStorageに使用回数を保存
function saveGuestUsage(usage: GuestUsage): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  }
}

// ゲストユーザーの使用回数をインクリメント
export function incrementGuestUsage(
  type: keyof Omit<GuestUsage, 'date'>
): { success: boolean; currentUsage?: GuestUsage; error?: string } {
  try {
    const usage = getGuestUsageToday();
    const limit = DEFAULT_GUEST_LIMITS[type];
    const currentCount = usage[type];
    
    // 制限チェック
    if (currentCount >= limit) {
      return {
        success: false,
        error: `今日の${getUsageTypeName(type)}制限（${limit}回）に達しました。`
      };
    }
    
    // カウントをインクリメント
    const updatedUsage = {
      ...usage,
      [type]: currentCount + 1
    };
    
    saveGuestUsage(updatedUsage);
    
    return {
      success: true,
      currentUsage: updatedUsage
    };
    
  } catch (error) {
    console.error('Error incrementing guest usage:', error);
    return {
      success: false,
      error: '使用回数の更新に失敗しました。'
    };
  }
}

// ゲストユーザーの使用制限をチェック
export function checkGuestUsageLimit(
  type: keyof Omit<GuestUsage, 'date'>
): { canUse: boolean; currentCount: number; limit: number } {
  const usage = getGuestUsageToday();
  const limit = DEFAULT_GUEST_LIMITS[type];
  const currentCount = usage[type];
  
  return {
    canUse: currentCount < limit,
    currentCount,
    limit
  };
}

// 使用タイプの日本語名を取得
function getUsageTypeName(type: string): string {
  switch (type) {
    case 'imageGeneration':
      return '画像生成';
    case 'poseExtraction':
      return 'ポーズ抽出';
    case 'commercialUse':
      return '商用利用';
    default:
      return '使用';
  }
}

// ゲストユーザーの統計情報を取得（簡易版）
export function getGuestStats(): {
  todayImageGeneration: number;
  todayPoseExtraction: number;
  todayCommercialUse: number;
} {
  const usage = getGuestUsageToday();
  
  return {
    todayImageGeneration: usage.imageGeneration,
    todayPoseExtraction: usage.poseExtraction,
    todayCommercialUse: usage.commercialUse,
  };
}

// ゲストユーザーの使用回数をリセット（デバッグ用）
export function resetGuestUsage(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// ゲストユーザーかどうか判定
export function isGuestUser(): boolean {
  // 実際の認証システムと連携する場合はここを修正
  // 今は全ユーザーをゲストとして扱う
  return true;
}