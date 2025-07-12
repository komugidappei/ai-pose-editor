// Images テーブル用のTypeScriptライブラリ
// Row Level Security (RLS) に対応した安全な画像管理

import { supabase } from './supabase';

// 画像データの型定義
export interface ImageRecord {
  id: string;
  user_id: string;
  filename: string;
  original_name?: string;
  mime_type: string;
  file_size?: number;
  width?: number;
  height?: number;
  storage_path?: string;
  public_url?: string;
  metadata?: Record<string, any>;
  is_public: boolean;
  tags?: string[];
  description?: string;
  created_at: string;
  updated_at: string;
}

// 画像挿入用の型
export type CreateImageData = Omit<ImageRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

// 画像更新用の型
export type UpdateImageData = Partial<Omit<ImageRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

// レスポンス型
export interface ImageResponse<T = ImageRecord> {
  data: T | null;
  error: string | null;
  statusCode?: number;
}

export interface ImageListResponse {
  data: ImageRecord[] | null;
  error: string | null;
  statusCode?: number;
  count?: number;
}

// ====================
// 基本的なCRUD操作
// ====================

/**
 * 現在のユーザーの画像一覧を取得
 * RLSにより自動的に自分の画像のみが返される
 */
export async function getMyImages(options?: {
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'updated_at' | 'filename';
  ascending?: boolean;
}): Promise<ImageListResponse> {
  try {
    const {
      limit = 50,
      offset = 0,
      orderBy = 'created_at',
      ascending = false
    } = options || {};

    const { data, error, count } = await supabase
      .from('images')
      .select('*', { count: 'exact' })
      .order(orderBy, { ascending })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching images:', error);
      return {
        data: null,
        error: error.message,
        statusCode: error.code === 'PGRST301' ? 403 : 500
      };
    }

    return {
      data: data || [],
      error: null,
      count: count || 0
    };
  } catch (err) {
    console.error('Unexpected error in getMyImages:', err);
    return {
      data: null,
      error: '予期しないエラーが発生しました',
      statusCode: 500
    };
  }
}

/**
 * 特定の画像を取得
 * RLSにより自分の画像のみアクセス可能
 */
export async function getImageById(imageId: string): Promise<ImageResponse> {
  try {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('id', imageId)
      .single();

    if (error) {
      console.error('Error fetching image:', error);
      return {
        data: null,
        error: error.code === 'PGRST116' ? '画像が見つかりません' : error.message,
        statusCode: error.code === 'PGRST116' ? 404 : error.code === 'PGRST301' ? 403 : 500
      };
    }

    return {
      data,
      error: null
    };
  } catch (err) {
    console.error('Unexpected error in getImageById:', err);
    return {
      data: null,
      error: '予期しないエラーが発生しました',
      statusCode: 500
    };
  }
}

/**
 * 新しい画像レコードを作成
 * RLSにより自動的に現在のユーザーのIDが設定される
 */
export async function createImage(imageData: CreateImageData): Promise<ImageResponse> {
  try {
    // ユーザーが認証されているかチェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        data: null,
        error: 'ユーザーが認証されていません',
        statusCode: 401
      };
    }

    const { data, error } = await supabase
      .from('images')
      .insert([{
        ...imageData,
        user_id: user.id, // 現在のユーザーIDを自動設定
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating image:', error);
      return {
        data: null,
        error: error.message,
        statusCode: error.code === 'PGRST301' ? 403 : 500
      };
    }

    return {
      data,
      error: null
    };
  } catch (err) {
    console.error('Unexpected error in createImage:', err);
    return {
      data: null,
      error: '予期しないエラーが発生しました',
      statusCode: 500
    };
  }
}

/**
 * 画像レコードを更新
 * RLSにより自分の画像のみ更新可能
 */
export async function updateImage(imageId: string, updates: UpdateImageData): Promise<ImageResponse> {
  try {
    const { data, error } = await supabase
      .from('images')
      .update(updates)
      .eq('id', imageId)
      .select()
      .single();

    if (error) {
      console.error('Error updating image:', error);
      return {
        data: null,
        error: error.code === 'PGRST116' ? '画像が見つかりません' : error.message,
        statusCode: error.code === 'PGRST116' ? 404 : error.code === 'PGRST301' ? 403 : 500
      };
    }

    return {
      data,
      error: null
    };
  } catch (err) {
    console.error('Unexpected error in updateImage:', err);
    return {
      data: null,
      error: '予期しないエラーが発生しました',
      statusCode: 500
    };
  }
}

/**
 * 画像レコードを削除
 * RLSにより自分の画像のみ削除可能
 */
export async function deleteImage(imageId: string): Promise<ImageResponse<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('images')
      .delete()
      .eq('id', imageId)
      .select('id')
      .single();

    if (error) {
      console.error('Error deleting image:', error);
      return {
        data: null,
        error: error.code === 'PGRST116' ? '画像が見つかりません' : error.message,
        statusCode: error.code === 'PGRST116' ? 404 : error.code === 'PGRST301' ? 403 : 500
      };
    }

    return {
      data,
      error: null
    };
  } catch (err) {
    console.error('Unexpected error in deleteImage:', err);
    return {
      data: null,
      error: '予期しないエラーが発生しました',
      statusCode: 500
    };
  }
}

// ====================
// 高度な検索・フィルタリング
// ====================

/**
 * 画像を検索（タグ、説明文など）
 */
export async function searchImages(options: {
  query?: string;
  tags?: string[];
  mimeType?: string;
  isPublic?: boolean;
  limit?: number;
  offset?: number;
}): Promise<ImageListResponse> {
  try {
    const {
      query,
      tags,
      mimeType,
      isPublic,
      limit = 50,
      offset = 0
    } = options;

    let queryBuilder = supabase
      .from('images')
      .select('*', { count: 'exact' });

    // テキスト検索（ファイル名、説明文）
    if (query) {
      queryBuilder = queryBuilder.or(
        `filename.ilike.%${query}%,description.ilike.%${query}%`
      );
    }

    // タグ検索
    if (tags && tags.length > 0) {
      queryBuilder = queryBuilder.overlaps('tags', tags);
    }

    // MIMEタイプフィルタ
    if (mimeType) {
      queryBuilder = queryBuilder.eq('mime_type', mimeType);
    }

    // 公開フラグフィルタ
    if (typeof isPublic === 'boolean') {
      queryBuilder = queryBuilder.eq('is_public', isPublic);
    }

    const { data, error, count } = await queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error searching images:', error);
      return {
        data: null,
        error: error.message,
        statusCode: error.code === 'PGRST301' ? 403 : 500
      };
    }

    return {
      data: data || [],
      error: null,
      count: count || 0
    };
  } catch (err) {
    console.error('Unexpected error in searchImages:', err);
    return {
      data: null,
      error: '予期しないエラーが発生しました',
      statusCode: 500
    };
  }
}

/**
 * 公開画像一覧を取得（全ユーザーの公開画像）
 */
export async function getPublicImages(options?: {
  limit?: number;
  offset?: number;
}): Promise<ImageListResponse> {
  try {
    const { limit = 50, offset = 0 } = options || {};

    const { data, error, count } = await supabase
      .from('images')
      .select('*', { count: 'exact' })
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching public images:', error);
      return {
        data: null,
        error: error.message,
        statusCode: 500
      };
    }

    return {
      data: data || [],
      error: null,
      count: count || 0
    };
  } catch (err) {
    console.error('Unexpected error in getPublicImages:', err);
    return {
      data: null,
      error: '予期しないエラーが発生しました',
      statusCode: 500
    };
  }
}

// ====================
// 統計・分析関数
// ====================

/**
 * ユーザーの画像統計を取得
 */
export async function getImageStats(): Promise<{
  totalImages: number;
  totalSize: number;
  publicImages: number;
  recentImages: number;
  error?: string;
}> {
  try {
    // 基本統計を取得
    const { data: statsData, error: statsError } = await supabase
      .rpc('get_user_image_count');

    const { data: sizeData, error: sizeError } = await supabase
      .rpc('get_user_total_file_size');

    if (statsError || sizeError) {
      console.error('Error fetching stats:', statsError || sizeError);
    }

    // 追加統計をクエリで取得
    const { data: images, error: imagesError } = await supabase
      .from('images')
      .select('is_public, created_at');

    if (imagesError) {
      console.error('Error fetching image details:', imagesError);
      return {
        totalImages: 0,
        totalSize: 0,
        publicImages: 0,
        recentImages: 0,
        error: imagesError.message
      };
    }

    const publicImages = images?.filter(img => img.is_public).length || 0;
    
    // 過去7日間の画像数
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentImages = images?.filter(img => 
      new Date(img.created_at) > sevenDaysAgo
    ).length || 0;

    return {
      totalImages: statsData || 0,
      totalSize: sizeData || 0,
      publicImages,
      recentImages
    };
  } catch (err) {
    console.error('Unexpected error in getImageStats:', err);
    return {
      totalImages: 0,
      totalSize: 0,
      publicImages: 0,
      recentImages: 0,
      error: '統計の取得に失敗しました'
    };
  }
}

/**
 * 画像のメタデータを更新
 */
export async function updateImageMetadata(
  imageId: string, 
  metadata: Record<string, any>
): Promise<ImageResponse> {
  return updateImage(imageId, { metadata });
}

/**
 * 画像の公開状態を切り替え
 */
export async function toggleImagePublic(imageId: string): Promise<ImageResponse> {
  try {
    // 現在の状態を取得
    const { data: currentImage, error: fetchError } = await getImageById(imageId);
    
    if (fetchError || !currentImage) {
      return {
        data: null,
        error: fetchError || '画像が見つかりません',
        statusCode: 404
      };
    }

    // 公開状態を切り替え
    return updateImage(imageId, { is_public: !currentImage.is_public });
  } catch (err) {
    console.error('Unexpected error in toggleImagePublic:', err);
    return {
      data: null,
      error: '予期しないエラーが発生しました',
      statusCode: 500
    };
  }
}

// ====================
// ユーティリティ関数
// ====================

/**
 * ファイルサイズを人間が読みやすい形式に変換
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 画像の表示用URLを取得
 */
export function getImageDisplayUrl(image: ImageRecord): string {
  return image.public_url || image.storage_path || '';
}

/**
 * MIMEタイプから拡張子を取得
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff'
  };
  
  return mimeToExt[mimeType] || 'unknown';
}