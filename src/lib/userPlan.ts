// ユーザープラン管理システム
// 決済連携によるプラン状態管理と制限解除

import { createClient } from '@supabase/supabase-js';
import { PlanName, PlanLimits, getPlanLimits, checkPlanLimits } from '@/lib/stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface UserPlan {
  id: string;
  user_id: string;
  plan_name: PlanName;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  upgraded_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserUsage {
  id: string;
  user_id: string;
  date: string;
  image_generation_count: number;
  pose_extraction_count: number;
  commercial_use_count: number;
  total_images: number;
  created_at: string;
  updated_at: string;
}

export interface UserPlanStatus {
  plan: UserPlan;
  usage: UserUsage;
  limits: PlanLimits;
  canGenerate: boolean;
  canUpload: boolean;
  canUseCommercially: boolean;
  needsWatermark: boolean;
  remainingGenerations: number;
  remainingImages: number;
  daysUntilExpiry: number | null;
}

/**
 * ユーザーのプラン情報取得
 */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const { data, error } = await supabase
    .from('user_plans')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // デフォルトでFreeプランを作成
    const defaultPlan = {
      user_id: userId,
      plan_name: 'FREE' as PlanName,
      status: 'active' as const,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      upgraded_at: null,
      expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newPlan, error: createError } = await supabase
      .from('user_plans')
      .insert(defaultPlan)
      .select()
      .single();

    if (createError) {
      throw new Error('Failed to create default plan');
    }

    return newPlan;
  }

  return data;
}

/**
 * ユーザーの使用量取得
 */
export async function getUserUsage(userId: string, date?: string): Promise<UserUsage> {
  const targetDate = date || new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('user_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', targetDate)
    .single();

  if (error || !data) {
    // デフォルトで使用量レコードを作成
    const defaultUsage = {
      user_id: userId,
      date: targetDate,
      image_generation_count: 0,
      pose_extraction_count: 0,
      commercial_use_count: 0,
      total_images: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newUsage, error: createError } = await supabase
      .from('user_usage')
      .insert(defaultUsage)
      .select()
      .single();

    if (createError) {
      throw new Error('Failed to create default usage record');
    }

    return newUsage;
  }

  return data;
}

/**
 * ユーザーの総画像数取得
 */
export async function getTotalImageCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('user_images')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_deleted', false);

  if (error) {
    console.error('Failed to get total image count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * 包括的なプラン状態取得
 */
export async function getUserPlanStatus(userId: string): Promise<UserPlanStatus> {
  const [plan, usage] = await Promise.all([
    getUserPlan(userId),
    getUserUsage(userId),
  ]);

  const totalImages = await getTotalImageCount(userId);
  const limits = getPlanLimits(plan.plan_name);

  // 制限チェック
  const limitCheck = checkPlanLimits(plan.plan_name, {
    dailyGenerations: usage.image_generation_count,
    totalImages: totalImages,
    commercialUse: usage.commercial_use_count > 0,
  });

  // 残り回数計算
  const remainingGenerations = limits.dailyGenerations === -1 
    ? -1 
    : Math.max(0, limits.dailyGenerations - usage.image_generation_count);

  const remainingImages = Math.max(0, limits.totalImages - totalImages);

  // 有効期限まで日数計算
  let daysUntilExpiry: number | null = null;
  if (plan.expires_at) {
    const expiry = new Date(plan.expires_at);
    const now = new Date();
    daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    plan,
    usage: {
      ...usage,
      total_images: totalImages,
    },
    limits,
    canGenerate: limitCheck.canGenerate,
    canUpload: limitCheck.canUpload,
    canUseCommercially: limitCheck.canUseCommercially,
    needsWatermark: limitCheck.needsWatermark,
    remainingGenerations,
    remainingImages,
    daysUntilExpiry,
  };
}

/**
 * 使用量インクリメント
 */
export async function incrementUsage(
  userId: string,
  type: 'image_generation' | 'pose_extraction' | 'commercial_use'
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const fieldName = `${type}_count`;

  const { error } = await supabase
    .from('user_usage')
    .upsert({
      user_id: userId,
      date: today,
      [fieldName]: 1,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,date',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('Failed to increment usage:', error);
    throw new Error('Failed to update usage count');
  }
}

/**
 * プランアップグレード
 */
export async function upgradePlan(
  userId: string,
  newPlan: PlanName,
  stripeCustomerId: string,
  stripeSubscriptionId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_plans')
    .update({
      plan_name: newPlan,
      status: 'active',
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      upgraded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to upgrade plan:', error);
    throw new Error('Failed to upgrade plan');
  }

  // 使用量リセット（新しいプランの恩恵を即座に受けられるように）
  await resetDailyUsage(userId);
}

/**
 * プランダウングレード
 */
export async function downgradePlan(
  userId: string,
  reason: string = 'subscription_canceled'
): Promise<void> {
  const { error } = await supabase
    .from('user_plans')
    .update({
      plan_name: 'FREE',
      status: 'canceled',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      expires_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to downgrade plan:', error);
    throw new Error('Failed to downgrade plan');
  }

  // ダウングレードログ記録
  await supabase
    .from('payment_logs')
    .insert({
      user_id: userId,
      event_type: 'plan_downgraded',
      plan_name: 'FREE',
      notes: reason,
      created_at: new Date().toISOString(),
    });
}

/**
 * 日次使用量リセット
 */
export async function resetDailyUsage(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabase
    .from('user_usage')
    .upsert({
      user_id: userId,
      date: today,
      image_generation_count: 0,
      pose_extraction_count: 0,
      commercial_use_count: 0,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,date',
    });

  if (error) {
    console.error('Failed to reset daily usage:', error);
    throw new Error('Failed to reset daily usage');
  }
}

/**
 * 使用量制限チェック（アクション実行前）
 */
export async function checkActionAllowed(
  userId: string,
  action: 'generate' | 'upload' | 'commercial_use'
): Promise<{
  allowed: boolean;
  reason?: string;
  planStatus: UserPlanStatus;
}> {
  const planStatus = await getUserPlanStatus(userId);

  switch (action) {
    case 'generate':
      return {
        allowed: planStatus.canGenerate,
        reason: planStatus.canGenerate ? undefined : 'Daily generation limit exceeded',
        planStatus,
      };
    
    case 'upload':
      return {
        allowed: planStatus.canUpload,
        reason: planStatus.canUpload ? undefined : 'Total image limit exceeded',
        planStatus,
      };
    
    case 'commercial_use':
      return {
        allowed: planStatus.canUseCommercially,
        reason: planStatus.canUseCommercially ? undefined : 'Commercial use not allowed on current plan',
        planStatus,
      };
    
    default:
      return {
        allowed: false,
        reason: 'Invalid action',
        planStatus,
      };
  }
}

/**
 * プラン比較情報取得
 */
export function getPlanComparison(): {
  [key in PlanName]: {
    name: string;
    price: number;
    features: string[];
    limits: PlanLimits;
    recommended?: boolean;
  };
} {
  return {
    FREE: {
      name: 'Free',
      price: 0,
      features: [
        '1日10回まで画像生成',
        '最大10枚まで保存',
        'ウォーターマーク付き',
        '基本サポート',
      ],
      limits: getPlanLimits('FREE'),
    },
    PREMIUM: {
      name: 'Premium',
      price: 980,
      features: [
        '1日100回まで画像生成',
        '最大100枚まで保存',
        'ウォーターマークなし',
        '商用利用可能',
        '優先サポート',
      ],
      limits: getPlanLimits('PREMIUM'),
      recommended: true,
    },
    PRO: {
      name: 'Pro',
      price: 1980,
      features: [
        '無制限画像生成',
        '最大1000枚まで保存',
        'ウォーターマークなし',
        '商用利用可能',
        '最優先サポート',
        'API アクセス',
      ],
      limits: getPlanLimits('PRO'),
    },
  };
}