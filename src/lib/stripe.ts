// Stripe決済システム - サーバー側設定
// セキュリティ最優先：Webhook検証、署名確認、レート制限

import Stripe from 'stripe';

// Stripe初期化（サーバー側のみ）
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
  maxNetworkRetries: 3,
  timeout: 10000, // 10秒タイムアウト
});

// プラン設定
export const SUBSCRIPTION_PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    priceId: null,
    limits: {
      dailyGenerations: 10,
      totalImages: 10,
      commercialUse: false,
      watermark: true,
      priority: 'low' as const,
    },
  },
  PREMIUM: {
    name: 'Premium',
    price: 980, // 月額980円
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID,
    limits: {
      dailyGenerations: 100,
      totalImages: 100,
      commercialUse: true,
      watermark: false,
      priority: 'normal' as const,
    },
  },
  PRO: {
    name: 'Pro',
    price: 1980, // 月額1980円
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    limits: {
      dailyGenerations: -1, // 無制限
      totalImages: 1000,
      commercialUse: true,
      watermark: false,
      priority: 'high' as const,
    },
  },
} as const;

export type PlanName = keyof typeof SUBSCRIPTION_PLANS;
export type PlanLimits = typeof SUBSCRIPTION_PLANS[PlanName]['limits'];

/**
 * セキュアなCheckout Session作成
 */
export async function createCheckoutSession(
  planName: PlanName,
  userId: string,
  userEmail: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const plan = SUBSCRIPTION_PLANS[planName];
  
  if (planName === 'FREE') {
    throw new Error('Free plan does not require payment');
  }

  if (!plan.priceId) {
    throw new Error(`Price ID not configured for ${planName} plan`);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: userEmail,
      metadata: {
        userId: userId,
        planName: planName,
        // セキュリティ用のハッシュ
        signature: generateMetadataSignature(userId, planName),
      },
      subscription_data: {
        metadata: {
          userId: userId,
          planName: planName,
        },
      },
      // セキュリティ設定
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['JP'], // 日本のみ
      },
      // 決済後の処理
      allow_promotion_codes: true,
      automatic_tax: {
        enabled: true,
      },
    });

    return session;
  } catch (error) {
    console.error('Stripe checkout session creation failed:', error);
    throw new Error('Failed to create checkout session');
  }
}

/**
 * セキュアなカスタマーポータルセッション作成
 */
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session;
  } catch (error) {
    console.error('Customer portal session creation failed:', error);
    throw new Error('Failed to create customer portal session');
  }
}

/**
 * サブスクリプション状態取得
 */
export async function getSubscriptionStatus(
  customerId: string
): Promise<{
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
  planName: PlanName;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}> {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 1,
    });

    const subscription = subscriptions.data[0];
    
    if (!subscription) {
      return {
        status: 'canceled',
        planName: 'FREE',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };
    }

    // プラン名をmetadataから取得
    const planName = (subscription.metadata.planName as PlanName) || 'FREE';

    return {
      status: subscription.status as any,
      planName,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
  } catch (error) {
    console.error('Failed to get subscription status:', error);
    throw new Error('Failed to get subscription status');
  }
}

/**
 * サブスクリプションキャンセル
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });

    return subscription;
  } catch (error) {
    console.error('Failed to cancel subscription:', error);
    throw new Error('Failed to cancel subscription');
  }
}

/**
 * メタデータ署名生成（セキュリティ用）
 */
function generateMetadataSignature(userId: string, planName: string): string {
  const crypto = require('crypto');
  const data = `${userId}:${planName}:${process.env.STRIPE_WEBHOOK_SECRET}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * メタデータ署名検証
 */
export function verifyMetadataSignature(
  userId: string,
  planName: string,
  signature: string
): boolean {
  const expectedSignature = generateMetadataSignature(userId, planName);
  return signature === expectedSignature;
}

/**
 * Webhook署名検証
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): Stripe.Event {
  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    return event;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    throw new Error('Invalid webhook signature');
  }
}

/**
 * プラン制限取得
 */
export function getPlanLimits(planName: PlanName): PlanLimits {
  return SUBSCRIPTION_PLANS[planName].limits;
}

/**
 * プラン制限チェック
 */
export function checkPlanLimits(
  planName: PlanName,
  usage: {
    dailyGenerations: number;
    totalImages: number;
    commercialUse: boolean;
  }
): {
  canGenerate: boolean;
  canUpload: boolean;
  canUseCommercially: boolean;
  needsWatermark: boolean;
  errors: string[];
} {
  const limits = getPlanLimits(planName);
  const errors: string[] = [];

  const canGenerate = limits.dailyGenerations === -1 || 
                     usage.dailyGenerations < limits.dailyGenerations;
  
  const canUpload = usage.totalImages < limits.totalImages;
  
  const canUseCommercially = limits.commercialUse;
  
  const needsWatermark = limits.watermark;

  if (!canGenerate) {
    errors.push(`Daily generation limit exceeded (${limits.dailyGenerations})`);
  }
  
  if (!canUpload) {
    errors.push(`Total image limit exceeded (${limits.totalImages})`);
  }
  
  if (usage.commercialUse && !canUseCommercially) {
    errors.push('Commercial use not allowed on this plan');
  }

  return {
    canGenerate,
    canUpload,
    canUseCommercially,
    needsWatermark,
    errors,
  };
}