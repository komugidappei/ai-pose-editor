// Stripe Checkout Session 作成API
// セキュリティ最優先：入力検証、レート制限、認証確認

import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession, PlanName, SUBSCRIPTION_PLANS } from '@/lib/stripe';
import { rateLimit } from '@/lib/rateLimit';
import { sanitizeAllTextInputs } from '@/lib/inputSanitization';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアント
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// レート制限（1分間に5回まで）
const checkoutRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 5, // 5回まで
  message: 'Too many checkout attempts',
});

/**
 * 入力値検証
 */
function validateCheckoutRequest(data: any): {
  valid: boolean;
  errors: string[];
  sanitized?: {
    planName: PlanName;
    userId: string;
    userEmail: string;
    successUrl: string;
    cancelUrl: string;
  };
} {
  const errors: string[] = [];

  // 必須フィールドチェック
  if (!data.planName || !data.userId || !data.userEmail || !data.successUrl || !data.cancelUrl) {
    errors.push('Missing required fields');
  }

  // プラン名検証
  if (!Object.keys(SUBSCRIPTION_PLANS).includes(data.planName)) {
    errors.push('Invalid plan name');
  }

  if (data.planName === 'FREE') {
    errors.push('Free plan does not require payment');
  }

  // URL検証
  try {
    new URL(data.successUrl);
    new URL(data.cancelUrl);
  } catch {
    errors.push('Invalid URLs');
  }

  // メールアドレス検証
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.userEmail)) {
    errors.push('Invalid email address');
  }

  // UUID検証
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(data.userId)) {
    errors.push('Invalid user ID');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 入力値サニタイズ
  const sanitized = sanitizeAllTextInputs(data);

  return {
    valid: true,
    errors: [],
    sanitized: {
      planName: sanitized.planName as PlanName,
      userId: sanitized.userId,
      userEmail: sanitized.userEmail,
      successUrl: sanitized.successUrl,
      cancelUrl: sanitized.cancelUrl,
    },
  };
}

/**
 * ユーザー認証確認
 */
async function verifyUserAuth(userId: string, userEmail: string): Promise<boolean> {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .eq('email', userEmail)
      .single();

    return !!user;
  } catch {
    return false;
  }
}

/**
 * 既存サブスクリプション確認
 */
async function checkExistingSubscription(userId: string): Promise<{
  hasActive: boolean;
  currentPlan: PlanName;
}> {
  try {
    const { data: userPlan } = await supabase
      .from('user_plans')
      .select('plan_name, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (userPlan) {
      return {
        hasActive: true,
        currentPlan: userPlan.plan_name as PlanName,
      };
    }

    return {
      hasActive: false,
      currentPlan: 'FREE',
    };
  } catch {
    return {
      hasActive: false,
      currentPlan: 'FREE',
    };
  }
}

/**
 * Checkout Session作成エンドポイント
 */
export async function POST(request: NextRequest) {
  try {
    // レート制限チェック
    const rateLimitResult = await checkoutRateLimit(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // リクエストボディ取得
    const body = await request.json();

    // 入力値検証
    const validation = validateCheckoutRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'Invalid request',
          details: validation.errors 
        },
        { status: 400 }
      );
    }

    const { planName, userId, userEmail, successUrl, cancelUrl } = validation.sanitized!;

    // ユーザー認証確認
    const isValidUser = await verifyUserAuth(userId, userEmail);
    if (!isValidUser) {
      return NextResponse.json(
        { error: 'User authentication failed' },
        { status: 401 }
      );
    }

    // 既存サブスクリプション確認
    const existingSubscription = await checkExistingSubscription(userId);
    if (existingSubscription.hasActive) {
      return NextResponse.json(
        { 
          error: 'User already has active subscription',
          currentPlan: existingSubscription.currentPlan
        },
        { status: 409 }
      );
    }

    // Checkout Session作成
    const session = await createCheckoutSession(
      planName,
      userId,
      userEmail,
      successUrl,
      cancelUrl
    );

    // 作成ログ記録
    await supabase
      .from('payment_logs')
      .insert({
        user_id: userId,
        event_type: 'checkout_session_created',
        plan_name: planName,
        stripe_session_id: session.id,
        created_at: new Date().toISOString(),
      });

    return NextResponse.json({
      sessionId: session.id,
      planName: planName,
      amount: SUBSCRIPTION_PLANS[planName].price,
    });

  } catch (error) {
    console.error('Checkout session creation failed:', error);

    // エラーログ記録
    await supabase
      .from('payment_logs')
      .insert({
        user_id: body?.userId || 'unknown',
        event_type: 'checkout_session_failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        created_at: new Date().toISOString(),
      });

    return NextResponse.json(
      { 
        error: 'Failed to create checkout session',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Other methods not allowed
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}