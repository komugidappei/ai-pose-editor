// 日次制限状況取得APIエンドポイント
// フロントエンドから制限状況を確認するためのAPI

import { NextRequest, NextResponse } from 'next/server';
import { 
  checkDailyGenerationLimit, 
  getClientIpAddress,
  generateRateLimitHeaders 
} from '@/lib/dailyGenerationLimit';
import { supabase } from '@/lib/supabase';

/**
 * ユーザー認証状態の確認
 */
async function getUserFromRequest(request: NextRequest): Promise<{ user: any; isAuthenticated: boolean }> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, isAuthenticated: false };
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { user: null, isAuthenticated: false };
    }

    return { user, isAuthenticated: true };
  } catch (error) {
    console.error('ユーザー認証確認エラー:', error);
    return { user: null, isAuthenticated: false };
  }
}

/**
 * GET: 日次制限状況を取得
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Daily limit status check requested');

    // 1. ユーザー認証確認
    const { user, isAuthenticated } = await getUserFromRequest(request);
    const userId = user?.id || 'guest';

    // 2. IPアドレスを取得（ゲストユーザー用）
    const clientIp = !isAuthenticated ? getClientIpAddress(request) : undefined;

    console.log(`🔍 Checking limit for ${isAuthenticated ? `user: ${userId}` : `guest IP: ${clientIp}`}`);

    // 3. 制限状況をチェック
    const limitStatus = await checkDailyGenerationLimit(userId, clientIp, 10);

    // 4. レスポンスヘッダーを生成
    const rateLimitHeaders = generateRateLimitHeaders(limitStatus);

    console.log(`📈 Limit status: ${limitStatus.currentCount}/${limitStatus.limit}, remaining: ${limitStatus.remaining}`);

    // 5. レスポンスを返す
    const response = NextResponse.json({
      success: true,
      limitStatus: {
        userId: limitStatus.userId,
        currentCount: limitStatus.currentCount,
        limit: limitStatus.limit,
        remaining: limitStatus.remaining,
        canGenerate: limitStatus.canGenerate,
        resetTime: limitStatus.resetTime,
        isGuest: limitStatus.isGuest
      },
      message: limitStatus.canGenerate 
        ? `残り${limitStatus.remaining}回の生成が可能です`
        : `本日の生成制限（${limitStatus.limit}回）に達しています`,
      fetchedAt: new Date().toISOString()
    });

    // Rate Limitヘッダーを追加
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;

  } catch (error) {
    console.error('Daily limit status API error:', error);
    
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR',
        message: '制限状況の取得中にエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * POST: 制限状況の強制更新（認証済みユーザーのみ）
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Daily limit status refresh requested');

    // 1. ユーザー認証確認
    const { user, isAuthenticated } = await getUserFromRequest(request);
    
    if (!isAuthenticated) {
      return NextResponse.json(
        { 
          error: 'UNAUTHORIZED',
          message: '制限状況の更新には認証が必要です' 
        },
        { status: 401 }
      );
    }

    const userId = user.id;

    // 2. 制限状況を取得（強制更新）
    const limitStatus = await checkDailyGenerationLimit(userId, undefined, 10);

    console.log(`🔄 Refreshed limit status for user ${userId}: ${limitStatus.currentCount}/${limitStatus.limit}`);

    // 3. レスポンスヘッダーを生成
    const rateLimitHeaders = generateRateLimitHeaders(limitStatus);

    // 4. レスポンスを返す
    const response = NextResponse.json({
      success: true,
      limitStatus: {
        userId: limitStatus.userId,
        currentCount: limitStatus.currentCount,
        limit: limitStatus.limit,
        remaining: limitStatus.remaining,
        canGenerate: limitStatus.canGenerate,
        resetTime: limitStatus.resetTime,
        isGuest: limitStatus.isGuest
      },
      message: '制限状況を更新しました',
      refreshedAt: new Date().toISOString()
    });

    // Rate Limitヘッダーを追加
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;

  } catch (error) {
    console.error('Daily limit refresh API error:', error);
    
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR',
        message: '制限状況の更新中にエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS: CORS対応
 */
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}