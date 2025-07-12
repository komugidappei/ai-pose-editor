// 署名付きURL生成API
// プライベート画像へのセキュアなアクセスを提供

import { NextRequest, NextResponse } from 'next/server';
import { createSignedUrl, checkFileExists } from '@/lib/privateImageStorage';
import { rateLimit, rateLimitPresets } from '@/lib/rateLimit';

// レート制限設定（署名付きURL生成は頻繁に呼ばれるため）
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1分間
  max: 30, // 最大30回
  message: '署名付きURL生成の回数制限に達しました。少し待ってから再試行してください。'
});

interface SignedUrlRequest {
  filePath: string;
  userId: string;
  expiresIn?: number;
}

interface SignedUrlResponse {
  success: boolean;
  signedUrl?: string;
  expiresAt?: string;
  error?: string;
}

/**
 * リクエストデータの検証
 */
function validateRequest(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.filePath || typeof data.filePath !== 'string') {
    errors.push('ファイルパスが必要です');
  }

  if (!data.userId || typeof data.userId !== 'string') {
    errors.push('ユーザーIDが必要です');
  }

  if (data.expiresIn && (typeof data.expiresIn !== 'number' || data.expiresIn < 1 || data.expiresIn > 3600)) {
    errors.push('有効期限は1秒〜1時間の範囲で指定してください');
  }

  // ファイルパスのセキュリティチェック
  if (data.filePath && !data.filePath.startsWith(data.userId + '/')) {
    errors.push('不正なファイルパスです');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * ユーザー認証の確認（簡易版）
 */
async function validateUser(request: NextRequest, userId: string): Promise<{ isValid: boolean; error?: string }> {
  try {
    // Authorization ヘッダーからトークンを取得
    const authHeader = request.headers.get('authorization');
    
    // ゲストユーザーの場合はリクエストヘッダーでチェック
    const requestUserId = request.headers.get('x-user-id');
    
    if (!authHeader && !requestUserId) {
      return { isValid: false, error: '認証が必要です' };
    }

    // 簡易的なユーザーマッチング（実際の実装では認証トークンを検証）
    if (requestUserId && requestUserId !== userId) {
      return { isValid: false, error: 'アクセス権限がありません' };
    }

    // TODO: 実際の認証トークン検証
    // const { data: { user }, error } = await supabase.auth.getUser(token);
    // if (error || !user || user.id !== userId) {
    //   return { isValid: false, error: 'アクセス権限がありません' };
    // }

    return { isValid: true };

  } catch (error) {
    console.error('User validation error:', error);
    return { isValid: false, error: '認証確認中にエラーが発生しました' };
  }
}

/**
 * POSTハンドラー: 署名付きURL生成
 */
export async function POST(request: NextRequest) {
  try {
    // 1. レート制限チェック
    const rateLimitResult = await limiter(request);
    if (!rateLimitResult.success && rateLimitResult.response) {
      return rateLimitResult.response;
    }

    // 2. リクエストボディの取得と検証
    const body = await request.json();
    const validation = validateRequest(body);
    
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false,
          error: '入力データに問題があります',
          details: validation.errors 
        },
        { status: 400 }
      );
    }

    const { filePath, userId, expiresIn = 300 }: SignedUrlRequest = body;

    // 3. ユーザー認証確認
    const userValidation = await validateUser(request, userId);
    if (!userValidation.isValid) {
      return NextResponse.json(
        { 
          success: false,
          error: userValidation.error 
        },
        { status: 403 }
      );
    }

    // 4. ファイル存在確認
    const fileCheck = await checkFileExists(filePath);
    if (!fileCheck.exists) {
      return NextResponse.json(
        { 
          success: false,
          error: 'ファイルが見つかりません' 
        },
        { status: 404 }
      );
    }

    // 5. 署名付きURL生成
    const signedUrlResult = await createSignedUrl(filePath, expiresIn);
    
    if (!signedUrlResult.success) {
      console.error('Signed URL generation failed:', signedUrlResult.error);
      return NextResponse.json(
        { 
          success: false,
          error: '署名付きURL生成に失敗しました' 
        },
        { status: 500 }
      );
    }

    // 6. 成功レスポンス
    const response: SignedUrlResponse = {
      success: true,
      signedUrl: signedUrlResult.signedUrl,
      expiresAt: signedUrlResult.expiresAt?.toISOString()
    };

    const finalResponse = NextResponse.json(response);
    
    // レート制限ヘッダーを追加
    if (rateLimitResult.remaining !== undefined) {
      finalResponse.headers.set('X-RateLimit-Limit', '30');
      finalResponse.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    }
    if (rateLimitResult.resetTime) {
      finalResponse.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
    }

    // キャッシュ制御（署名付きURLは短時間のみ有効）
    finalResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    finalResponse.headers.set('Pragma', 'no-cache');
    finalResponse.headers.set('Expires', '0');

    return finalResponse;

  } catch (error) {
    console.error('Signed URL API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: '署名付きURL生成中に予期しないエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * 一括署名付きURL生成（複数画像用）
 */
interface BatchSignedUrlRequest {
  filePaths: string[];
  userId: string;
  expiresIn?: number;
}

interface BatchSignedUrlResponse {
  success: boolean;
  results?: Array<{
    filePath: string;
    signedUrl?: string;
    expiresAt?: string;
    error?: string;
  }>;
  error?: string;
}

export async function PUT(request: NextRequest) {
  try {
    // レート制限チェック
    const rateLimitResult = await limiter(request);
    if (!rateLimitResult.success && rateLimitResult.response) {
      return rateLimitResult.response;
    }

    const body = await request.json();
    const { filePaths, userId, expiresIn = 300 }: BatchSignedUrlRequest = body;

    // 基本検証
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ファイルパスの配列が必要です' },
        { status: 400 }
      );
    }

    if (filePaths.length > 20) {
      return NextResponse.json(
        { success: false, error: '一度に処理できるファイル数は20個までです' },
        { status: 400 }
      );
    }

    // ユーザー認証確認
    const userValidation = await validateUser(request, userId);
    if (!userValidation.isValid) {
      return NextResponse.json(
        { success: false, error: userValidation.error },
        { status: 403 }
      );
    }

    // 各ファイルの署名付きURL生成
    const results = [];
    for (const filePath of filePaths) {
      // ファイルパスのセキュリティチェック
      if (!filePath.startsWith(userId + '/')) {
        results.push({
          filePath,
          error: '不正なファイルパスです'
        });
        continue;
      }

      // 署名付きURL生成
      const signedUrlResult = await createSignedUrl(filePath, expiresIn);
      
      if (signedUrlResult.success) {
        results.push({
          filePath,
          signedUrl: signedUrlResult.signedUrl,
          expiresAt: signedUrlResult.expiresAt?.toISOString()
        });
      } else {
        results.push({
          filePath,
          error: signedUrlResult.error
        });
      }
    }

    const response: BatchSignedUrlResponse = {
      success: true,
      results
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Batch signed URL API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: '一括署名付きURL生成中にエラーが発生しました'
      },
      { status: 500 }
    );
  }
}

/**
 * GET: APIの情報を返す
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Signed URL Generation API',
    endpoints: {
      POST: '/api/images/signed-url - 単一ファイルの署名付きURL生成',
      PUT: '/api/images/signed-url - 複数ファイルの署名付きURL一括生成'
    },
    parameters: {
      filePath: 'string (required) - Private storage file path',
      userId: 'string (required) - User ID for access control',
      expiresIn: 'number (optional) - Expiration time in seconds (1-3600, default 300)'
    },
    limits: {
      rateLimit: '30 requests per minute',
      batchLimit: '20 files per batch request',
      maxExpiration: '3600 seconds (1 hour)'
    }
  });
}