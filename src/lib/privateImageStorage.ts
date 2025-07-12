// Supabase Storage - Private画像保存と署名付きURL生成
// セキュアな画像表示システム

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service Role Key を使用（署名付きURL生成のため）
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// プライベートバケット設定
const PRIVATE_BUCKET = 'private-images';
const SIGNED_URL_EXPIRES_IN = 300; // 5分間

// アップロード結果の型定義
export interface PrivateUploadResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
  publicUrl?: string; // 署名付きURL
}

// 署名付きURL結果の型定義
export interface SignedUrlResult {
  success: boolean;
  signedUrl?: string;
  expiresAt?: Date;
  error?: string;
}

// 画像リスト結果の型定義
export interface ImageListResult {
  success: boolean;
  images?: Array<{
    name: string;
    metadata?: any;
    created_at: string;
    updated_at: string;
    size: number;
  }>;
  error?: string;
}

/**
 * プライベートバケットが存在するかチェック、なければ作成
 */
export async function ensurePrivateBucket(): Promise<{ success: boolean; error?: string }> {
  try {
    // 既存バケットを確認
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      return { success: false, error: `バケット一覧取得エラー: ${listError.message}` };
    }

    const bucketExists = buckets?.some(bucket => bucket.name === PRIVATE_BUCKET);

    if (!bucketExists) {
      // プライベートバケットを作成
      const { error: createError } = await supabaseAdmin.storage.createBucket(PRIVATE_BUCKET, {
        public: false, // プライベート設定
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg'],
        fileSizeLimit: 10 * 1024 * 1024 // 10MB
      });

      if (createError) {
        return { success: false, error: `バケット作成エラー: ${createError.message}` };
      }

      console.log(`✅ Private bucket '${PRIVATE_BUCKET}' created successfully`);
    }

    return { success: true };

  } catch (error) {
    console.error('ensurePrivateBucket error:', error);
    return { 
      success: false, 
      error: `バケット確認中にエラーが発生: ${error instanceof Error ? error.message : '不明なエラー'}` 
    };
  }
}

/**
 * 画像をプライベートバケットにアップロード
 */
export async function uploadToPrivateStorage(
  userId: string,
  file: File | Buffer,
  options: {
    fileName?: string;
    folder?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<PrivateUploadResult> {
  try {
    // バケットの存在確認
    const bucketCheck = await ensurePrivateBucket();
    if (!bucketCheck.success) {
      return { success: false, error: bucketCheck.error };
    }

    // ファイル名の生成
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = options.fileName || `image_${timestamp}_${randomSuffix}.png`;
    
    // フォルダ構造: userId/folder/fileName
    const folder = options.folder || 'generated';
    const filePath = `${userId}/${folder}/${fileName}`;

    // ファイルデータの準備
    let fileData: ArrayBuffer;
    let fileSize: number;

    if (file instanceof File) {
      fileData = await file.arrayBuffer();
      fileSize = file.size;
    } else {
      fileData = file.buffer;
      fileSize = file.length;
    }

    // プライベートストレージにアップロード
    const { data, error } = await supabaseAdmin.storage
      .from(PRIVATE_BUCKET)
      .upload(filePath, fileData, {
        contentType: 'image/png',
        metadata: {
          userId,
          uploadedAt: new Date().toISOString(),
          ...options.metadata
        },
        upsert: false // 既存ファイルは上書きしない
      });

    if (error) {
      console.error('Upload error:', error);
      return { 
        success: false, 
        error: `アップロードエラー: ${error.message}` 
      };
    }

    console.log(`✅ File uploaded to private storage: ${data.path}`);

    return {
      success: true,
      filePath: data.path,
      fileName,
      fileSize,
    };

  } catch (error) {
    console.error('uploadToPrivateStorage error:', error);
    return { 
      success: false, 
      error: `アップロード中にエラーが発生: ${error instanceof Error ? error.message : '不明なエラー'}` 
    };
  }
}

/**
 * Base64画像をプライベートストレージにアップロード
 */
export async function uploadBase64ToPrivateStorage(
  userId: string,
  base64Data: string,
  options: {
    fileName?: string;
    folder?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<PrivateUploadResult> {
  try {
    // Base64データをBufferに変換
    let buffer: Buffer;
    
    if (base64Data.startsWith('data:')) {
      // Data URLの場合
      const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return { success: false, error: '無効なBase64データです' };
      }
      
      const base64Content = matches[2];
      buffer = Buffer.from(base64Content, 'base64');
    } else {
      // 純粋なBase64の場合
      buffer = Buffer.from(base64Data, 'base64');
    }

    return await uploadToPrivateStorage(userId, buffer, options);

  } catch (error) {
    console.error('uploadBase64ToPrivateStorage error:', error);
    return { 
      success: false, 
      error: `Base64アップロード中にエラーが発生: ${error instanceof Error ? error.message : '不明なエラー'}` 
    };
  }
}

/**
 * 署名付きURLを生成（一時的なアクセス用）
 */
export async function createSignedUrl(
  filePath: string,
  expiresIn: number = SIGNED_URL_EXPIRES_IN
): Promise<SignedUrlResult> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Signed URL creation error:', error);
      return { 
        success: false, 
        error: `署名付きURL作成エラー: ${error.message}` 
      };
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
      success: true,
      signedUrl: data.signedUrl,
      expiresAt
    };

  } catch (error) {
    console.error('createSignedUrl error:', error);
    return { 
      success: false, 
      error: `署名付きURL作成中にエラーが発生: ${error instanceof Error ? error.message : '不明なエラー'}` 
    };
  }
}

/**
 * 複数ファイルの署名付きURLを一括生成
 */
export async function createMultipleSignedUrls(
  filePaths: string[],
  expiresIn: number = SIGNED_URL_EXPIRES_IN
): Promise<Array<{ filePath: string; result: SignedUrlResult }>> {
  const results = [];

  for (const filePath of filePaths) {
    const result = await createSignedUrl(filePath, expiresIn);
    results.push({ filePath, result });
  }

  return results;
}

/**
 * ユーザーの画像一覧を取得
 */
export async function listUserImages(
  userId: string,
  options: {
    folder?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<ImageListResult> {
  try {
    const folder = options.folder || 'generated';
    const prefix = `${userId}/${folder}/`;

    const { data, error } = await supabaseAdmin.storage
      .from(PRIVATE_BUCKET)
      .list(prefix, {
        limit: options.limit || 50,
        offset: options.offset || 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('List images error:', error);
      return { 
        success: false, 
        error: `画像一覧取得エラー: ${error.message}` 
      };
    }

    return {
      success: true,
      images: data || []
    };

  } catch (error) {
    console.error('listUserImages error:', error);
    return { 
      success: false, 
      error: `画像一覧取得中にエラーが発生: ${error instanceof Error ? error.message : '不明なエラー'}` 
    };
  }
}

/**
 * ファイルを削除
 */
export async function deletePrivateFile(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.storage
      .from(PRIVATE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Delete file error:', error);
      return { 
        success: false, 
        error: `ファイル削除エラー: ${error.message}` 
      };
    }

    console.log(`✅ File deleted: ${filePath}`);
    return { success: true };

  } catch (error) {
    console.error('deletePrivateFile error:', error);
    return { 
      success: false, 
      error: `ファイル削除中にエラーが発生: ${error instanceof Error ? error.message : '不明なエラー'}` 
    };
  }
}

/**
 * ユーザーの全ファイルを削除
 */
export async function deleteAllUserFiles(userId: string): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    // ユーザーの画像一覧を取得
    const listResult = await listUserImages(userId);
    if (!listResult.success || !listResult.images) {
      return { success: false, deletedCount: 0, error: listResult.error };
    }

    // 削除するファイルパスを作成
    const filePaths = listResult.images.map(img => `${userId}/generated/${img.name}`);

    if (filePaths.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    // 一括削除
    const { error } = await supabaseAdmin.storage
      .from(PRIVATE_BUCKET)
      .remove(filePaths);

    if (error) {
      console.error('Delete user files error:', error);
      return { 
        success: false, 
        deletedCount: 0,
        error: `ユーザーファイル削除エラー: ${error.message}` 
      };
    }

    console.log(`✅ Deleted ${filePaths.length} files for user ${userId}`);
    return { success: true, deletedCount: filePaths.length };

  } catch (error) {
    console.error('deleteAllUserFiles error:', error);
    return { 
      success: false, 
      deletedCount: 0,
      error: `ユーザーファイル削除中にエラーが発生: ${error instanceof Error ? error.message : '不明なエラー'}` 
    };
  }
}

/**
 * 画像の存在確認
 */
export async function checkFileExists(filePath: string): Promise<{ exists: boolean; metadata?: any; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(PRIVATE_BUCKET)
      .list(filePath.substring(0, filePath.lastIndexOf('/')), {
        search: filePath.substring(filePath.lastIndexOf('/') + 1)
      });

    if (error) {
      return { exists: false, error: error.message };
    }

    const exists = data && data.length > 0;
    const metadata = exists ? data[0] : undefined;

    return { exists, metadata };

  } catch (error) {
    console.error('checkFileExists error:', error);
    return { 
      exists: false, 
      error: `ファイル存在確認中にエラーが発生: ${error instanceof Error ? error.message : '不明なエラー'}` 
    };
  }
}

/**
 * ストレージ使用量統計を取得
 */
export async function getStorageStats(userId: string): Promise<{
  success: boolean;
  totalFiles?: number;
  totalSize?: number;
  error?: string;
}> {
  try {
    const listResult = await listUserImages(userId);
    if (!listResult.success || !listResult.images) {
      return { success: false, error: listResult.error };
    }

    const totalFiles = listResult.images.length;
    const totalSize = listResult.images.reduce((sum, img) => sum + (img.size || 0), 0);

    return {
      success: true,
      totalFiles,
      totalSize
    };

  } catch (error) {
    console.error('getStorageStats error:', error);
    return { 
      success: false, 
      error: `ストレージ統計取得中にエラーが発生: ${error instanceof Error ? error.message : '不明なエラー'}` 
    };
  }
}