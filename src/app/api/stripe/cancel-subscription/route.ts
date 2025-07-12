// サブスクリプションキャンセルAPI
// セキュリティ強化：認証確認、署名検証、監査ログ

import { NextRequest, NextResponse } from 'next/server';
import { cancelSubscription } from '@/lib/stripe';
import { rateLimit } from '@/lib/rateLimit';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// レート制限（1分間に3回まで）
const cancelRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: 'Too many cancellation attempts',
});

export async function POST(request: NextRequest) {
  try {
    // レート制限チェック
    const rateLimitResult = await cancelRateLimit(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    const { userId, cancelAtPeriodEnd = true } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // ユーザーのサブスクリプション情報取得
    const { data: userPlan, error } = await supabase
      .from('user_plans')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !userPlan?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Stripeでサブスクリプションキャンセル
    const subscription = await cancelSubscription(
      userPlan.stripe_subscription_id,
      cancelAtPeriodEnd
    );

    // データベース更新
    await supabase
      .from('user_plans')
      .update({
        status: cancelAtPeriodEnd ? 'active' : 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    // 監査ログ記録
    await supabase
      .from('payment_logs')
      .insert({
        user_id: userId,
        event_type: 'subscription_cancelled',
        stripe_subscription_id: userPlan.stripe_subscription_id,
        notes: cancelAtPeriodEnd ? 'Cancel at period end' : 'Immediate cancellation',
        created_at: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    });

  } catch (error) {
    console.error('Subscription cancellation failed:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}