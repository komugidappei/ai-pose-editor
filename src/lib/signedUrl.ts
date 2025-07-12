// Supabase Storage 署名付きURL管理ライブラリ
// 画像をprivateバケットに保存し、署名付きURLで安全にアクセス

import { supabase } from './supabase';

// 署名付きURLの設定
export const SIGNED_URL_CONFIG = {
  defaultExpiresIn: 60, // 60秒
  maxExpiresIn: 3600, // 最大1時間
  buckets: {
    privateImages: 'private-images',
    publicImages: 'public-images',
    thumbnails: 'thumbnails'
  }
} as const;

// アップロード結果の型定義
export interface ImageUploadResult {
  success: boolean;
  filePath?: string;
  publicUrl?: string;
  signedUrl?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

// 署名付きURL生成結果の型定義
export interface SignedUrlResult {
  success: boolean;
  signedUrl?: string;
  expiresAt?: string;
  error?: string;
}

/**
 * 安全なファイルパスを生成
 */
function generateSafeFilePath(userId: string, fileName: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const extension = fileName.split('.').pop() || 'png';
  const safeFileName = `${timestamp}_${randomSuffix}.${extension}`;
  
  return `${userId}/${safeFileName}`;
}

/**
 * Supabase Storageのバケットが存在するかチェック
 */
async function ensureBucketExists(bucketName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.getBucket(bucketName);
    
    if (error && error.message.includes('not found')) {
      // バケットが存在しない場合は作成を試行
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: false, // プライベートバケット
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
        fileSizeLimit: 10 * 1024 * 1024 // 10MB
      });
      
      if (createError) {
        console.error(`バケット作成失敗 (${bucketName}):`, createError);
        return false;
      }
      
      console.log(`プライベートバケット作成成功: ${bucketName}`);
      return true;
    }
    
    if (error) {
      console.error(`バケット確認エラー (${bucketName}):`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`バケット確認中にエラーが発生 (${bucketName}):`, error);
    return false;
  }
}

/**
 * 画像をプライベートバケットにアップロード
 */
export async function uploadImageToPrivateStorage(
  userId: string,
  file: File | Buffer,
  options?: {
    fileName?: string;
    bucketName?: string;
    generateThumbnail?: boolean;
  }
): Promise<ImageUploadResult> {
  try {
    const {
      fileName = file instanceof File ? file.name : 'uploaded-image.png',
      bucketName = SIGNED_URL_CONFIG.buckets.privateImages,
      generateThumbnail = false
    } = options || {};

    // バケットの存在確認
    const bucketExists = await ensureBucketExists(bucketName);
    if (!bucketExists) {
      return {
        success: false,
        error: `バケット ${bucketName} の作成に失敗しました`
      };
    }

    // 安全なファイルパスを生成
    const filePath = generateSafeFilePath(userId, fileName);

    // ファイルデータを準備
    let fileData: ArrayBuffer;
    let fileSize: number;

    if (file instanceof File) {
      fileData = await file.arrayBuffer();
      fileSize = file.size;
    } else {
      fileData = file.buffer;
      fileSize = file.length;
    }

    // Supabase Storageにアップロード
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileData, {
        contentType: file instanceof File ? file.type : 'image/png',
        cacheControl: '3600', // 1時間キャッシュ
        upsert: false // 上書きしない
      });

    if (error) {
      console.error('画像アップロードエラー:', error);
      return {
        success: false,
        error: `画像アップロードに失敗しました: ${error.message}`
      };
    }

    // 署名付きURLを生成
    const signedUrlResult = await createSignedUrl(bucketName, data.path);
    
    if (!signedUrlResult.success) {
      console.warn('署名付きURL生成に失敗しましたが、アップロードは成功しました');
    }

    return {
      success: true,
      filePath: data.path,
      signedUrl: signedUrlResult.signedUrl,
      fileName: data.path.split('/').pop(),
      fileSize
    };

  } catch (error) {
    console.error('画像アップロード中にエラーが発生:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '予期しないエラーが発生しました'
    };
  }
}

/**
 * 署名付きURLを生成
 */
export async function createSignedUrl(
  bucketName: string,
  filePath: string,
  expiresIn: number = SIGNED_URL_CONFIG.defaultExpiresIn
): Promise<SignedUrlResult> {
  try {
    // 有効期限の制限
    const validExpiresIn = Math.min(expiresIn, SIGNED_URL_CONFIG.maxExpiresIn);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, validExpiresIn);

    if (error) {
      console.error('署名付きURL生成エラー:', error);
      return {
        success: false,
        error: `署名付きURL生成に失敗しました: ${error.message}`
      };
    }

    // 有効期限を計算
    const expiresAt = new Date(Date.now() + validExpiresIn * 1000).toISOString();

    return {
      success: true,
      signedUrl: data.signedUrl,
      expiresAt
    };

  } catch (error) {
    console.error('署名付きURL生成中にエラーが発生:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '予期しないエラーが発生しました'
    };
  }
}

/**
 * 複数ファイルの署名付きURLを一括生成
 */
export async function createMultipleSignedUrls(
  bucketName: string,
  filePaths: string[],
  expiresIn: number = SIGNED_URL_CONFIG.defaultExpiresIn
): Promise<Array<{ filePath: string; result: SignedUrlResult }>> {
  const results = await Promise.allSettled(
    filePaths.map(async (filePath) => ({
      filePath,
      result: await createSignedUrl(bucketName, filePath, expiresIn)
    }))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        filePath: filePaths[index],
        result: {
          success: false,
          error: result.reason instanceof Error ? result.reason.message : '処理に失敗しました'
        }
      };
    }
  });
}

/**
 * 画像を安全に削除
 */
export async function deleteImageFromPrivateStorage(
  bucketName: string,
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      console.error('画像削除エラー:', error);
      return {
        success: false,
        error: `画像削除に失敗しました: ${error.message}`
      };
    }

    return { success: true };

  } catch (error) {
    console.error('画像削除中にエラーが発生:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '予期しないエラーが発生しました'
    };
  }
}

/**
 * ユーザーの画像一覧を取得（署名付きURL付き）
 */
export async function getUserImagesWithSignedUrls(
  userId: string,
  options?: {
    bucketName?: string;
    expiresIn?: number;
    limit?: number;
  }
): Promise<Array<{
  filePath: string;
  signedUrl?: string;
  error?: string;
}>> {
  try {
    const {
      bucketName = SIGNED_URL_CONFIG.buckets.privateImages,
      expiresIn = SIGNED_URL_CONFIG.defaultExpiresIn,
      limit = 50
    } = options || {};

    // ユーザーのフォルダ内のファイル一覧を取得
    const { data: files, error } = await supabase.storage
      .from(bucketName)
      .list(userId, {
        limit,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('ファイル一覧取得エラー:', error);
      return [];
    }

    if (!files || files.length === 0) {
      return [];
    }

    // 署名付きURLを一括生成
    const filePaths = files.map(file => `${userId}/${file.name}`);
    const signedUrls = await createMultipleSignedUrls(bucketName, filePaths, expiresIn);

    return signedUrls.map(({ filePath, result }) => ({
      filePath,
      signedUrl: result.signedUrl,
      error: result.error
    }));

  } catch (error) {
    console.error('ユーザー画像取得中にエラーが発生:', error);
    return [];
  }
}

/**
 * Base64画像をプライベートストレージにアップロード
 */
export async function uploadBase64ImageToPrivateStorage(
  userId: string,
  base64Data: string,
  options?: {
    fileName?: string;
    bucketName?: string;
  }
): Promise<ImageUploadResult> {
  try {
    // Base64データを解析
    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return {
        success: false,
        error: '無効なBase64画像データです'
      };
    }

    const mimeType = matches[1];
    const base64Content = matches[2];

    // MIMEタイプの検証
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(mimeType)) {
      return {
        success: false,
        error: `対応していない画像形式です: ${mimeType}`
      };
    }

    // Base64をBufferに変換
    const buffer = Buffer.from(base64Content, 'base64');

    // 拡張子を決定
    const extension = mimeType === 'image/png' ? 'png' : 'jpg';
    const fileName = options?.fileName || `upload.${extension}`;

    return await uploadImageToPrivateStorage(userId, buffer, {
      ...options,
      fileName
    });

  } catch (error) {
    console.error('Base64画像アップロード中にエラーが発生:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '予期しないエラーが発生しました'
    };
  }
}

/**
 * 署名付きURLのキャッシュ管理
 */
class SignedUrlCache {
  private cache = new Map<string, { url: string; expiresAt: number }>();

  get(key: string): string | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // 有効期限をチェック（5秒の余裕を持たせる）
    if (Date.now() > cached.expiresAt - 5000) {
      this.cache.delete(key);
      return null;
    }

    return cached.url;
  }

  set(key: string, url: string, expiresIn: number): void {
    const expiresAt = Date.now() + expiresIn * 1000;
    this.cache.set(key, { url, expiresAt });
  }

  clear(): void {
    this.cache.clear();
  }

  // 期限切れエントリを削除
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

export const signedUrlCache = new SignedUrlCache();

/**
 * キャッシュ付きの署名付きURL生成
 */
export async function createCachedSignedUrl(
  bucketName: string,
  filePath: string,
  expiresIn: number = SIGNED_URL_CONFIG.defaultExpiresIn
): Promise<SignedUrlResult> {
  const cacheKey = `${bucketName}:${filePath}`;
  
  // キャッシュから取得を試行
  const cachedUrl = signedUrlCache.get(cacheKey);
  if (cachedUrl) {
    return {
      success: true,
      signedUrl: cachedUrl
    };
  }

  // キャッシュにない場合は新規生成
  const result = await createSignedUrl(bucketName, filePath, expiresIn);
  
  if (result.success && result.signedUrl) {
    signedUrlCache.set(cacheKey, result.signedUrl, expiresIn);
  }

  return result;
}

// 定期的にキャッシュをクリーンアップ（5分間隔）
if (typeof window !== 'undefined') {
  setInterval(() => {
    signedUrlCache.cleanup();
  }, 5 * 60 * 1000);
}