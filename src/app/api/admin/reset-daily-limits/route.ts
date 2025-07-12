// 管理者用の日次制限リセットAPIエンドポイント
// 古いレコードのクリーンアップとメンテナンス

import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldGenerationRecords } from '@/lib/dailyGenerationLimit';

/**
 * 管理者権限チェック（実装例）
 */
async function checkAdminPermission(request: NextRequest): Promise<boolean> {
  try {
    // 管理者認証トークンをチェック
    const authHeader = request.headers.get('authorization');
    const adminKey = request.headers.get('x-admin-key');
    
    // 環境変数から管理者キーを取得
    const expectedAdminKey = process.env.ADMIN_API_KEY;
    
    if (!expectedAdminKey) {
      console.error('ADMIN_API_KEY が設定されていません');
      return false;
    }
    
    // 管理者キーの検証
    if (adminKey === expectedAdminKey) {
      return true;
    }
    
    // または、Supabaseの管理者ロールをチェック
    // const { supabase } = await import('@/lib/supabase');
    // const token = authHeader?.replace('Bearer ', '');
    // if (token) {
    //   const { data: { user }, error } = await supabase.auth.getUser(token);
    //   if (user && user.app_metadata?.role === 'admin') {
    //     return true;
    //   }
    // }
    
    return false;
  } catch (error) {
    console.error('管理者権限チェックエラー:', error);
    return false;
  }
}

/**
 * POST: 古い生成記録のクリーンアップ
 */
export async function POST(request: NextRequest) {
  try {
    // 管理者権限チェック
    const hasAdminPermission = await checkAdminPermission(request);
    if (!hasAdminPermission) {
      return NextResponse.json(
        { 
          error: 'FORBIDDEN',
          message: '管理者権限が必要です' 
        },
        { status: 403 }
      );
    }

    console.log('🧹 Starting daily limits cleanup...');

    // 古いレコードをクリーンアップ
    const cleanupResult = await cleanupOldGenerationRecords();

    if (!cleanupResult.success) {
      return NextResponse.json(
        { 
          error: 'CLEANUP_FAILED',
          message: 'クリーンアップに失敗しました' 
        },
        { status: 500 }
      );
    }

    console.log('✅ Daily limits cleanup completed:', {
      deletedAuthRecords: cleanupResult.deletedAuthRecords,
      deletedGuestRecords: cleanupResult.deletedGuestRecords
    });

    return NextResponse.json({
      success: true,
      message: 'クリーンアップが完了しました',
      results: {
        deletedAuthRecords: cleanupResult.deletedAuthRecords,
        deletedGuestRecords: cleanupResult.deletedGuestRecords,
        executedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Daily limits cleanup API error:', error);
    
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR',
        message: 'クリーンアップ中にエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET: 現在の制限状況を取得
 */
export async function GET(request: NextRequest) {
  try {
    // 管理者権限チェック
    const hasAdminPermission = await checkAdminPermission(request);
    if (!hasAdminPermission) {
      return NextResponse.json(
        { 
          error: 'FORBIDDEN',
          message: '管理者権限が必要です' 
        },
        { status: 403 }
      );
    }

    const { getAdminGenerationStatistics } = await import('@/lib/dailyGenerationLimit');
    
    // 過去7日間の統計を取得
    const stats = await getAdminGenerationStatistics(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7日前
      new Date() // 今日
    );

    return NextResponse.json({
      success: true,
      statistics: stats,
      currentDate: new Date().toISOString(),
      period: '7days'
    });

  } catch (error) {
    console.error('Admin statistics API error:', error);
    
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR',
        message: '統計取得中にエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 特定ユーザーの制限をリセット（緊急時用）
 */
export async function DELETE(request: NextRequest) {
  try {
    // 管理者権限チェック
    const hasAdminPermission = await checkAdminPermission(request);
    if (!hasAdminPermission) {
      return NextResponse.json(
        { 
          error: 'FORBIDDEN',
          message: '管理者権限が必要です' 
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const ipAddress = searchParams.get('ipAddress');

    if (!userId && !ipAddress) {
      return NextResponse.json(
        { 
          error: 'BAD_REQUEST',
          message: 'userIdまたはipAddressが必要です' 
        },
        { status: 400 }
      );
    }

    const { resetDailyLimitForTesting } = await import('@/lib/dailyGenerationLimit');
    
    // 開発環境でなくても管理者なら実行可能
    const success = await resetDailyLimitForTesting(userId || 'guest', ipAddress);

    if (!success) {
      return NextResponse.json(
        { 
          error: 'RESET_FAILED',
          message: '制限リセットに失敗しました' 
        },
        { status: 500 }
      );
    }

    console.log(`🔄 Admin reset daily limit for ${userId ? `user: ${userId}` : `IP: ${ipAddress}`}`);

    return NextResponse.json({
      success: true,
      message: '制限がリセットされました',
      target: userId ? { userId } : { ipAddress },
      executedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin reset API error:', error);
    
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR',
        message: 'リセット中にエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}