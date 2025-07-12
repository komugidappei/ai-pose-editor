// Stripe Webhook - セキュアな決済完了処理
// セキュリティ最優先：署名検証、レート制限、冪等性確保

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { 
  verifyWebhookSignature, 
  verifyMetadataSignature,
  PlanName 
} from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rateLimit';

// Supabaseクライアント（サーバー用）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Webhook処理レート制限（1分間に30回まで）
const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 30, // 30回まで
  message: 'Too many webhook requests',
});

/**
 * 冪等性確保のためのイベント処理履歴
 */
const processedEvents = new Set<string>();

/**
 * ユーザープラン更新（セキュア）
 */
async function updateUserPlan(
  userId: string,
  planName: PlanName,
  customerId: string,
  subscriptionId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_plans')
    .upsert({
      user_id: userId,
      plan_name: planName,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: 'active',
      upgraded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Failed to update user plan:', error);
    throw new Error('Failed to update user plan');
  }

  // 使用量制限もリセット
  await supabase
    .from('user_usage')
    .upsert({
      user_id: userId,
      date: new Date().toISOString().split('T')[0],
      image_generation_count: 0,
      pose_extraction_count: 0,
      commercial_use_count: 0,
      updated_at: new Date().toISOString(),
    });
}

/**
 * 決済完了処理
 */
async function handleCheckoutCompleted(event: any): Promise<void> {
  const session = event.data.object;
  
  const userId = session.metadata?.userId;
  const planName = session.metadata?.planName as PlanName;
  const signature = session.metadata?.signature;

  if (!userId || !planName || !signature) {
    console.error('Missing required metadata in checkout session');
    throw new Error('Invalid session metadata');
  }

  // メタデータ署名検証（改ざん防止）
  if (!verifyMetadataSignature(userId, planName, signature)) {
    console.error('Invalid metadata signature');
    throw new Error('Invalid metadata signature');
  }

  // 顧客情報取得
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!customerId || !subscriptionId) {
    console.error('Missing customer or subscription ID');
    throw new Error('Invalid payment session');
  }

  // データベース更新
  await updateUserPlan(userId, planName, customerId, subscriptionId);

  // 監査ログ記録
  await supabase
    .from('payment_logs')
    .insert({
      user_id: userId,
      event_type: 'checkout_completed',
      plan_name: planName,
      amount: session.amount_total,
      currency: session.currency,
      stripe_session_id: session.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      created_at: new Date().toISOString(),
    });

  console.log(`✅ User ${userId} upgraded to ${planName} plan`);
}

/**
 * サブスクリプション更新処理
 */
async function handleSubscriptionUpdated(event: any): Promise<void> {
  const subscription = event.data.object;
  
  const userId = subscription.metadata?.userId;
  const planName = subscription.metadata?.planName as PlanName;

  if (!userId || !planName) {
    console.error('Missing metadata in subscription');
    return;
  }

  // ステータス更新
  const status = subscription.status === 'active' ? 'active' : 'canceled';
  
  await supabase
    .from('user_plans')
    .update({
      status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('stripe_subscription_id', subscription.id);

  console.log(`📱 User ${userId} subscription status: ${status}`);
}

/**
 * サブスクリプション削除処理
 */
async function handleSubscriptionDeleted(event: any): Promise<void> {
  const subscription = event.data.object;
  
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('Missing metadata in subscription');
    return;
  }

  // プランをFreeにダウングレード
  await updateUserPlan(userId, 'FREE', '', '');

  // 監査ログ記録
  await supabase
    .from('payment_logs')
    .insert({
      user_id: userId,
      event_type: 'subscription_deleted',
      plan_name: 'FREE',
      stripe_subscription_id: subscription.id,
      created_at: new Date().toISOString(),
    });

  console.log(`⬇️ User ${userId} downgraded to FREE plan`);
}

/**
 * 決済失敗処理
 */
async function handlePaymentFailed(event: any): Promise<void> {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) {
    return;
  }

  // サブスクリプション情報を取得してユーザー特定
  const { data: userPlan } = await supabase
    .from('user_plans')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!userPlan) {
    return;
  }

  // 支払い失敗ログ記録
  await supabase
    .from('payment_logs')
    .insert({
      user_id: userPlan.user_id,
      event_type: 'payment_failed',
      stripe_subscription_id: subscriptionId,
      created_at: new Date().toISOString(),
    });

  console.log(`❌ Payment failed for user ${userPlan.user_id}`);
}

/**
 * Stripe Webhook エンドポイント
 */
export async function POST(request: NextRequest) {
  try {
    // レート制限チェック
    const rateLimitResult = await webhookRateLimit(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // リクエストボディとヘッダー取得
    const body = await request.text();
    const headersList = headers();
    const sig = headersList.get('stripe-signature');

    if (!sig) {
      console.error('Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Webhook署名検証
    let event;
    try {
      event = verifyWebhookSignature(body, sig);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // 冪等性チェック（重複処理防止）
    const eventId = event.id;
    if (processedEvents.has(eventId)) {
      console.log(`Event ${eventId} already processed`);
      return NextResponse.json({ received: true });
    }

    console.log(`🔄 Processing webhook event: ${event.type}`);

    // イベントタイプ別処理
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // 処理済みイベントとしてマーク
    processedEvents.add(eventId);

    // 古いイベントIDを削除（メモリ節約）
    if (processedEvents.size > 1000) {
      const oldestEvents = Array.from(processedEvents).slice(0, 500);
      oldestEvents.forEach(id => processedEvents.delete(id));
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook processing failed:', error);
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET request is not allowed
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}