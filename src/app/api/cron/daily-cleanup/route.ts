// 日次クリーンアップのCron job APIエンドポイント
// Vercel Cron または外部Cronサービスから呼び出される

import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldGenerationRecords } from '@/lib/dailyGenerationLimit';

/**
 * Cron認証の確認
 */
function validateCronRequest(request: NextRequest): boolean {
  // Vercel Cronの場合
  const cronSecret = request.headers.get('x-vercel-cron-secret');
  const expectedCronSecret = process.env.CRON_SECRET;
  
  if (expectedCronSecret && cronSecret === expectedCronSecret) {
    return true;
  }
  
  // 外部Cronサービスの場合
  const authHeader = request.headers.get('authorization');
  const cronToken = process.env.CRON_TOKEN;
  
  if (cronToken && authHeader === `Bearer ${cronToken}`) {
    return true;
  }
  
  // 開発環境では認証をスキップ
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ Development mode: Cron authentication skipped');
    return true;
  }
  
  return false;
}

/**
 * GET: 日次クリーンアップの実行
 * Cronジョブから呼び出される
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🕐 Daily cleanup cron job started');
    
    // Cron認証チェック
    if (!validateCronRequest(request)) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json(
        { 
          error: 'UNAUTHORIZED',
          message: 'Cron認証が無効です' 
        },
        { status: 401 }
      );
    }

    const startTime = Date.now();
    
    // 古い生成記録のクリーンアップ
    console.log('🧹 Starting daily generation records cleanup...');
    const cleanupResult = await cleanupOldGenerationRecords();
    
    if (!cleanupResult.success) {
      console.error('❌ Daily cleanup failed');
      return NextResponse.json(
        { 
          error: 'CLEANUP_FAILED',
          message: 'クリーンアップに失敗しました',
          executionTime: Date.now() - startTime
        },
        { status: 500 }
      );
    }

    const executionTime = Date.now() - startTime;
    
    console.log('✅ Daily cleanup completed successfully:', {
      deletedAuthRecords: cleanupResult.deletedAuthRecords,
      deletedGuestRecords: cleanupResult.deletedGuestRecords,
      executionTime: `${executionTime}ms`
    });

    // 成功レスポンス
    return NextResponse.json({
      success: true,
      message: '日次クリーンアップが完了しました',
      results: {
        deletedAuthRecords: cleanupResult.deletedAuthRecords,
        deletedGuestRecords: cleanupResult.deletedGuestRecords,
        executionTime,
        executedAt: new Date().toISOString(),
        nextExecution: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Daily cleanup cron error:', error);
    
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR',
        message: 'クリーンアップ中にエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
        executedAt: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST: 手動でのクリーンアップ実行
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Manual cleanup triggered');
    
    // 手動実行時も認証が必要
    if (!validateCronRequest(request)) {
      return NextResponse.json(
        { 
          error: 'UNAUTHORIZED',
          message: 'Cron認証が無効です' 
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const force = Boolean(body.force);
    
    console.log(`🚀 Manual cleanup started ${force ? '(forced)' : ''}`);
    
    const startTime = Date.now();
    const cleanupResult = await cleanupOldGenerationRecords();
    const executionTime = Date.now() - startTime;

    if (!cleanupResult.success) {
      return NextResponse.json(
        { 
          error: 'CLEANUP_FAILED',
          message: '手動クリーンアップに失敗しました',
          executionTime
        },
        { status: 500 }
      );
    }

    console.log('✅ Manual cleanup completed:', {
      deletedAuthRecords: cleanupResult.deletedAuthRecords,
      deletedGuestRecords: cleanupResult.deletedGuestRecords,
      executionTime: `${executionTime}ms`,
      forced: force
    });

    return NextResponse.json({
      success: true,
      message: '手動クリーンアップが完了しました',
      results: {
        deletedAuthRecords: cleanupResult.deletedAuthRecords,
        deletedGuestRecords: cleanupResult.deletedGuestRecords,
        executionTime,
        executedAt: new Date().toISOString(),
        manual: true,
        forced: force
      }
    });

  } catch (error) {
    console.error('❌ Manual cleanup error:', error);
    
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR',
        message: '手動クリーンアップ中にエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * HEAD: ヘルスチェック
 */
export async function HEAD(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'X-Cron-Status': 'healthy',
      'X-Last-Execution': new Date().toISOString()
    }
  });
}