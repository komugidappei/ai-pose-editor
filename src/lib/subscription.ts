'use client';

// ユーザーのサブスクリプション状態
export interface UserSubscription {
  userId: string;
  plan: 'free' | 'premium' | 'pro';
  status: 'active' | 'inactive' | 'cancelled' | 'expired';
  startDate: string;
  endDate?: string;
  features: string[];
  limits: {
    imageGeneration: number;
    poseExtraction: number;
    commercialUse: number;
    templateSlots: number;
    maxResolution: number;
    aiStyles: boolean;
    prioritySupport: boolean;
  };
}

// プランの定義
export const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free Plan',
    displayName: '無料プラン',
    price: 0,
    currency: 'JPY',
    interval: 'month',
    description: '基本的な機能を無料で利用',
    features: [
      '画像生成 10回/日',
      'ポーズ抽出 5回/日',
      '商用利用 2回/日',
      'テンプレート保存 3個',
      '解像度 512px',
      '基本スタイル 2種類'
    ],
    limits: {
      imageGeneration: 10,
      poseExtraction: 5,
      commercialUse: 2,
      templateSlots: 3,
      maxResolution: 512,
      aiStyles: false,
      prioritySupport: false
    }
  },
  premium: {
    name: 'Premium Plan',
    displayName: 'プレミアムプラン',
    price: 980,
    currency: 'JPY',
    interval: 'month',
    description: '月替わりAIスタイルと高機能',
    features: [
      '画像生成 100回/日',
      'ポーズ抽出 50回/日',
      '商用利用 無制限',
      'テンプレート保存 無制限',
      '解像度 1024px',
      '月替わりAIスタイル',
      'プレミアムスタイル 全種類',
      '優先サポート'
    ],
    limits: {
      imageGeneration: 100,
      poseExtraction: 50,
      commercialUse: -1, // -1 = 無制限
      templateSlots: -1,
      maxResolution: 1024,
      aiStyles: true,
      prioritySupport: true
    }
  },
  pro: {
    name: 'Pro Plan',
    displayName: 'プロプラン',
    price: 1980,
    currency: 'JPY',
    interval: 'month',
    description: 'プロフェッショナル向け最高プラン',
    features: [
      '画像生成 無制限',
      'ポーズ抽出 無制限',
      '商用利用 無制限',
      'テンプレート保存 無制限',
      '解像度 2048px',
      'AIスタイル 全種類',
      'カスタムスタイル作成',
      'API アクセス',
      '24時間サポート'
    ],
    limits: {
      imageGeneration: -1,
      poseExtraction: -1,
      commercialUse: -1,
      templateSlots: -1,
      maxResolution: 2048,
      aiStyles: true,
      prioritySupport: true
    }
  }
} as const;

// モックユーザーデータ（実際はデータベースから取得）
const MOCK_USER_SUBSCRIPTION: UserSubscription = {
  userId: 'guest',
  plan: 'free',
  status: 'active',
  startDate: '2024-01-01T00:00:00Z',
  features: SUBSCRIPTION_PLANS.free.features,
  limits: SUBSCRIPTION_PLANS.free.limits
};

// ローカルストレージのキー
const SUBSCRIPTION_STORAGE_KEY = 'ai-pose-editor-subscription';

// ユーザーのサブスクリプション情報を取得
export function getUserSubscription(userId: string = 'guest'): UserSubscription {
  if (typeof window === 'undefined') {
    return MOCK_USER_SUBSCRIPTION;
  }

  try {
    const stored = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
    if (stored) {
      const subscription: UserSubscription = JSON.parse(stored);
      
      // 期限チェック
      if (subscription.endDate && new Date(subscription.endDate) < new Date()) {
        // 期限切れの場合は無料プランに戻す
        const expiredSubscription: UserSubscription = {
          ...subscription,
          plan: 'free',
          status: 'expired',
          features: SUBSCRIPTION_PLANS.free.features,
          limits: SUBSCRIPTION_PLANS.free.limits
        };
        localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(expiredSubscription));
        return expiredSubscription;
      }
      
      return subscription;
    }
    
    return MOCK_USER_SUBSCRIPTION;
  } catch (error) {
    console.error('Error getting user subscription:', error);
    return MOCK_USER_SUBSCRIPTION;
  }
}

// ユーザーがプレミアムユーザーかチェック
export function isPremiumUser(userId: string = 'guest'): boolean {
  const subscription = getUserSubscription(userId);
  return subscription.plan !== 'free' && subscription.status === 'active';
}

// ユーザーがプロユーザーかチェック
export function isProUser(userId: string = 'guest'): boolean {
  const subscription = getUserSubscription(userId);
  return subscription.plan === 'pro' && subscription.status === 'active';
}

// 機能の利用可否をチェック
export function canUseFeature(feature: keyof UserSubscription['limits'], userId: string = 'guest'): boolean {
  const subscription = getUserSubscription(userId);
  const limit = subscription.limits[feature];
  
  // -1は無制限を意味する
  if (limit === -1) return true;
  
  // booleanの場合はそのまま返す
  if (typeof limit === 'boolean') return limit;
  
  return false;
}

// 使用制限をチェック
export function checkUsageLimit(
  feature: 'imageGeneration' | 'poseExtraction' | 'commercialUse' | 'templateSlots',
  currentUsage: number,
  userId: string = 'guest'
): { canUse: boolean; limit: number; remaining: number } {
  const subscription = getUserSubscription(userId);
  const limit = subscription.limits[feature] as number;
  
  // -1は無制限
  if (limit === -1) {
    return {
      canUse: true,
      limit: -1,
      remaining: -1
    };
  }
  
  const remaining = Math.max(0, limit - currentUsage);
  
  return {
    canUse: remaining > 0,
    limit,
    remaining
  };
}

// サブスクリプションをアップグレード（モック）
export function upgradeSubscription(
  userId: string,
  newPlan: 'premium' | 'pro'
): { success: boolean; error?: string } {
  try {
    const currentSubscription = getUserSubscription(userId);
    
    // 既に同じプランか、より上位のプランの場合
    if (currentSubscription.plan === newPlan) {
      return {
        success: false,
        error: '既に同じプランに加入しています'
      };
    }
    
    if (currentSubscription.plan === 'pro' && newPlan === 'premium') {
      return {
        success: false,
        error: 'プロプランからプレミアムプランへのダウングレードはできません'
      };
    }
    
    const planInfo = SUBSCRIPTION_PLANS[newPlan];
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // 1ヶ月後
    
    const newSubscription: UserSubscription = {
      userId,
      plan: newPlan,
      status: 'active',
      startDate: new Date().toISOString(),
      endDate: endDate.toISOString(),
      features: planInfo.features,
      limits: planInfo.limits
    };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(newSubscription));
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    return {
      success: false,
      error: 'アップグレードに失敗しました'
    };
  }
}

// サブスクリプションをキャンセル（モック）
export function cancelSubscription(userId: string): { success: boolean; error?: string } {
  try {
    const currentSubscription = getUserSubscription(userId);
    
    if (currentSubscription.plan === 'free') {
      return {
        success: false,
        error: '無料プランはキャンセルできません'
      };
    }
    
    const cancelledSubscription: UserSubscription = {
      ...currentSubscription,
      status: 'cancelled'
      // endDateはそのままにして、期限まで利用可能
    };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(cancelledSubscription));
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return {
      success: false,
      error: 'キャンセルに失敗しました'
    };
  }
}

// プラン比較データ
export function getPlanComparison() {
  return Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => ({
    id: key,
    ...plan
  }));
}

// アップグレード推奨メッセージ
export function getUpgradeMessage(feature: string): string {
  const messages = {
    aiStyles: 'プレミアムプランにアップグレードして、月替わりの豊富なAIスタイルをお楽しみください！',
    resolution: 'より高解像度の画像生成にはプレミアムプランが必要です',
    commercialUse: '商用利用の制限を解除するにはプレミアムプランにアップグレードしてください',
    templates: 'テンプレートの保存制限を解除するにはプレミアムプランが必要です',
    support: 'プレミアムプランで優先サポートをご利用いただけます'
  };
  
  return messages[feature as keyof typeof messages] || 'プレミアムプランでより多くの機能をご利用いただけます';
}

// 残り日数を計算
export function getDaysRemaining(userId: string = 'guest'): number {
  const subscription = getUserSubscription(userId);
  
  if (!subscription.endDate || subscription.plan === 'free') {
    return -1; // 無制限または無料プラン
  }
  
  const endDate = new Date(subscription.endDate);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

// サブスクリプション統計
export function getSubscriptionStats(userId: string = 'guest') {
  const subscription = getUserSubscription(userId);
  const daysRemaining = getDaysRemaining(userId);
  
  return {
    plan: subscription.plan,
    status: subscription.status,
    daysRemaining,
    isActive: subscription.status === 'active',
    isPremium: isPremiumUser(userId),
    isPro: isProUser(userId),
    features: subscription.features,
    limits: subscription.limits
  };
}