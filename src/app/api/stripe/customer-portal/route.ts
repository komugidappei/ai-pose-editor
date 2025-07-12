// カスタマーポータルAPI
// セキュリティ強化：認証確認、レート制限

import { NextRequest, NextResponse } from 'next/server';
import { createCustomerPortalSession } from '@/lib/stripe';
import { rateLimit } from '@/lib/rateLimit';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// レート制限（1分間に5回まで）
const portalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many portal requests',
});

export async function POST(request: NextRequest) {
  try {
    // レート制限チェック
    const rateLimitResult = await portalRateLimit(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    const { userId, returnUrl } = await request.json();

    if (!userId || !returnUrl) {
      return NextResponse.json(
        { error: 'User ID and return URL are required' },
        { status: 400 }
      );
    }

    // URL検証
    try {
      new URL(returnUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid return URL' },
        { status: 400 }
      );
    }

    // ユーザーのStripe顧客ID取得
    const { data: userPlan, error } = await supabase
      .from('user_plans')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (error || !userPlan?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No customer found' },
        { status: 404 }
      );
    }

    // カスタマーポータルセッション作成
    const session = await createCustomerPortalSession(
      userPlan.stripe_customer_id,
      returnUrl
    );

    return NextResponse.json({
      url: session.url,
    });

  } catch (error) {
    console.error('Customer portal creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create customer portal session' },
      { status: 500 }
    );
  }
}