// ユーザープラン状態取得API
// セキュリティ強化：認証確認、レート制限

import { NextRequest, NextResponse } from 'next/server';
import { getUserPlanStatus } from '@/lib/userPlan';
import { rateLimit } from '@/lib/rateLimit';

// レート制限（1分間に20回まで）
const planStatusRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many plan status requests',
});

export async function GET(request: NextRequest) {
  try {
    // レート制限チェック
    const rateLimitResult = await planStatusRateLimit(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // UUID検証
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // プラン状態取得
    const planStatus = await getUserPlanStatus(userId);

    return NextResponse.json(planStatus);

  } catch (error) {
    console.error('Failed to get plan status:', error);
    return NextResponse.json(
      { error: 'Failed to get plan status' },
      { status: 500 }
    );
  }
}