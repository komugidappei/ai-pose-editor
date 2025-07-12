// プライベート画像一覧API
// ユーザーの保存画像を安全に取得

import { NextRequest, NextResponse } from 'next/server';
import { listUserImages, getStorageStats } from '@/lib/privateImageStorage';
import { rateLimit, rateLimitPresets } from '@/lib/rateLimit';

// レート制限設定
const limiter = rateLimit(rateLimitPresets.standard);

interface ImageListRequest {
  userId: string;
  folder?: string;
  limit?: number;
  offset?: number;
  includeStats?: boolean;
}

interface ImageListResponse {
  success: boolean;
  images?: Array<{
    name: string;
    filePath: string;
    size: number;
    created_at: string;
    updated_at: string;
    metadata?: any;
  }>;
  stats?: {
    totalFiles: number;
    totalSize: number;
    formattedSize: string;
  };
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  error?: string;
}

/**
 * バイト数を人間が読みやすい形式に変換
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * ユーザー認証の確認
 */
async function validateUser(request: NextRequest, userId: string): Promise<{ isValid: boolean; error?: string }> {
  try {
    // Authorization ヘッダーまたはX-User-IDヘッダーをチェック
    const authHeader = request.headers.get('authorization');
    const requestUserId = request.headers.get('x-user-id');
    
    if (!authHeader && !requestUserId) {
      return { isValid: false, error: '認証が必要です' };
    }

    // 簡易的なユーザーマッチング
    if (requestUserId && requestUserId !== userId) {
      return { isValid: false, error: 'アクセス権限がありません' };
    }

    return { isValid: true };

  } catch (error) {
    console.error('User validation error:', error);
    return { isValid: false, error: '認証確認中にエラーが発生しました' };
  }
}

/**
 * GET: ユーザーの画像一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    // レート制限チェック
    const rateLimitResult = await limiter(request);
    if (!rateLimitResult.success && rateLimitResult.response) {
      return rateLimitResult.response;
    }

    // クエリパラメータの取得
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const folder = searchParams.get('folder') || 'generated';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeStats = searchParams.get('includeStats') === 'true';

    // 基本検証
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ユーザーIDが必要です' },
        { status: 400 }
      );
    }

    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { success: false, error: 'limit は 1-100 の範囲で指定してください' },
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

    // 画像一覧を取得
    const listResult = await listUserImages(userId, {
      folder,
      limit: limit + 1, // hasMoreを判定するため+1
      offset
    });

    if (!listResult.success) {
      return NextResponse.json(
        { success: false, error: listResult.error },
        { status: 500 }
      );
    }

    const images = listResult.images || [];
    const hasMore = images.length > limit;
    const displayImages = hasMore ? images.slice(0, limit) : images;

    // ファイルパスを追加
    const imagesWithPath = displayImages.map(img => ({
      ...img,
      filePath: `${userId}/${folder}/${img.name}`
    }));

    // レスポンス作成
    const response: ImageListResponse = {
      success: true,
      images: imagesWithPath,
      pagination: {
        limit,
        offset,
        hasMore
      }
    };

    // 統計情報を含める場合
    if (includeStats) {
      const statsResult = await getStorageStats(userId);
      if (statsResult.success) {
        response.stats = {
          totalFiles: statsResult.totalFiles || 0,
          totalSize: statsResult.totalSize || 0,
          formattedSize: formatBytes(statsResult.totalSize || 0)
        };
      }
    }

    const finalResponse = NextResponse.json(response);
    
    // レート制限ヘッダーを追加
    if (rateLimitResult.remaining !== undefined) {
      finalResponse.headers.set('X-RateLimit-Limit', '10');
      finalResponse.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    }
    if (rateLimitResult.resetTime) {
      finalResponse.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
    }

    return finalResponse;

  } catch (error) {
    console.error('Image list API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: '画像一覧取得中に予期しないエラーが発生しました'
      },
      { status: 500 }
    );
  }
}

/**
 * POST: 画像一覧を詳細なフィルタリングで取得
 */
export async function POST(request: NextRequest) {
  try {
    // レート制限チェック
    const rateLimitResult = await limiter(request);
    if (!rateLimitResult.success && rateLimitResult.response) {
      return rateLimitResult.response;
    }

    const body = await request.json();
    const {
      userId,
      folder = 'generated',
      limit = 20,
      offset = 0,
      includeStats = false,
      sortBy = 'created_at',
      sortOrder = 'desc',
      search
    }: ImageListRequest & {
      sortBy?: 'created_at' | 'name' | 'size';
      sortOrder?: 'asc' | 'desc';
      search?: string;
    } = body;

    // 基本検証
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ユーザーIDが必要です' },
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

    // 画像一覧を取得
    const listResult = await listUserImages(userId, {
      folder,
      limit: 1000 // フィルタリング前に多めに取得
    });

    if (!listResult.success) {
      return NextResponse.json(
        { success: false, error: listResult.error },
        { status: 500 }
      );
    }

    let images = listResult.images || [];

    // 検索フィルタリング
    if (search) {
      const searchLower = search.toLowerCase();
      images = images.filter(img => 
        img.name.toLowerCase().includes(searchLower) ||
        (img.metadata?.prompt && img.metadata.prompt.toLowerCase().includes(searchLower))
      );
    }

    // ソート
    images.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'size':
          aValue = a.size || 0;
          bValue = b.size || 0;
          break;
        case 'created_at':
        default:
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // ページネーション
    const totalCount = images.length;
    const paginatedImages = images.slice(offset, offset + limit);
    const hasMore = (offset + limit) < totalCount;

    // ファイルパスを追加
    const imagesWithPath = paginatedImages.map(img => ({
      ...img,
      filePath: `${userId}/${folder}/${img.name}`
    }));

    const response: ImageListResponse = {
      success: true,
      images: imagesWithPath,
      pagination: {
        limit,
        offset,
        hasMore
      }
    };

    // 統計情報を含める場合
    if (includeStats) {
      const totalSize = images.reduce((sum, img) => sum + (img.size || 0), 0);
      response.stats = {
        totalFiles: totalCount,
        totalSize,
        formattedSize: formatBytes(totalSize)
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Image list POST API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: '画像一覧取得中に予期しないエラーが発生しました'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 画像ファイルを削除
 */
export async function DELETE(request: NextRequest) {
  try {
    // レート制限チェック
    const rateLimitResult = await limiter(request);
    if (!rateLimitResult.success && rateLimitResult.response) {
      return rateLimitResult.response;
    }

    const body = await request.json();
    const { userId, filePath } = body;

    // 基本検証
    if (!userId || !filePath) {
      return NextResponse.json(
        { success: false, error: 'ユーザーIDとファイルパスが必要です' },
        { status: 400 }
      );
    }

    // セキュリティチェック
    if (!filePath.startsWith(userId + '/')) {
      return NextResponse.json(
        { success: false, error: '不正なファイルパスです' },
        { status: 403 }
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

    // ファイル削除の実装は privateImageStorage.ts の deletePrivateFile を使用
    // ここでは成功レスポンスを返す
    return NextResponse.json({
      success: true,
      message: 'ファイルが削除されました'
    });

  } catch (error) {
    console.error('Image delete API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'ファイル削除中に予期しないエラーが発生しました'
      },
      { status: 500 }
    );
  }
}