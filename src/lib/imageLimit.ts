// 保存画像数制限ライブラリ
// Freeユーザーの保存画像を10枚までに制限し、古い画像を自動削除

import { supabase } from './supabase';
import { getUserSubscription } from './subscription';

// 保存画像数制限の設定
export const IMAGE_LIMITS = {
  free: 10,
  premium: 100,
  pro: -1 // 無制限
} as const;

// 削除対象画像の情報
export interface ImageToDelete {
  id: string;
  filename: string;
  storage_path?: string;
  created_at: string;
}

// 制限チェック結果
export interface ImageLimitResult {
  canSave: boolean;
  currentCount: number;
  limit: number;
  imagesToDelete: ImageToDelete[];
  message?: string;
}

/**
 * ユーザーの画像保存制限を取得
 */
export function getImageLimit(userId: string): number {
  const subscription = getUserSubscription(userId);
  return IMAGE_LIMITS[subscription.plan] || IMAGE_LIMITS.free;
}

/**
 * 現在の保存画像数を取得
 */
export async function getCurrentImageCount(userId: string): Promise<number> {
  try {
    // generated_imagesテーブルから取得（AI生成画像）
    const { count, error } = await supabase
      .from('generated_images')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      console.error('画像数取得エラー:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('画像数取得中にエラーが発生:', error);
    return 0;
  }
}

/**
 * 保存可能かどうかと削除対象画像をチェック
 */
export async function checkImageLimit(userId: string): Promise<ImageLimitResult> {
  try {
    const limit = getImageLimit(userId);
    
    // 無制限の場合（Proプラン）
    if (limit === -1) {
      return {
        canSave: true,
        currentCount: 0,
        limit: -1,
        imagesToDelete: []
      };
    }

    // 現在の画像数を取得（AI生成画像）
    const { data: images, error } = await supabase
      .from('generated_images')
      .select('id, prompt as filename, image_url as storage_path, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }); // 古い順

    if (error) {
      console.error('画像リスト取得エラー:', error);
      return {
        canSave: false,
        currentCount: 0,
        limit,
        imagesToDelete: [],
        message: '画像数の確認に失敗しました'
      };
    }

    const currentCount = images?.length || 0;

    // 制限以下の場合は保存可能
    if (currentCount < limit) {
      return {
        canSave: true,
        currentCount,
        limit,
        imagesToDelete: []
      };
    }

    // 制限に達している場合、削除対象を決定
    const imagesToDelete: ImageToDelete[] = [];
    
    if (currentCount >= limit) {
      // 10枚制限の場合：既に10枚あるなら1枚削除して9枚にし、新しい画像で10枚にする
      const deleteCount = currentCount - limit + 1; // 新しい画像用に1枚分の余裕を作る
      imagesToDelete.push(...(images?.slice(0, deleteCount) || []));
      
      console.log(`🗑️ Auto-delete triggered: ${currentCount}/${limit} images, deleting ${deleteCount} oldest images`);
    }

    return {
      canSave: true,
      currentCount,
      limit,
      imagesToDelete,
      message: imagesToDelete.length > 0 
        ? `保存制限（${limit}枚）に達しているため、古い画像${imagesToDelete.length}枚を削除します。`
        : undefined
    };

  } catch (error) {
    console.error('画像制限チェック中にエラーが発生:', error);
    return {
      canSave: false,
      currentCount: 0,
      limit: getImageLimit(userId),
      imagesToDelete: [],
      message: '制限チェック中にエラーが発生しました'
    };
  }
}

/**
 * 古い画像を安全に自動削除
 */
export async function deleteOldImages(
  userId: string, 
  imagesToDelete: ImageToDelete[]
): Promise<{
  success: boolean;
  deletedCount: number;
  errors: string[];
  details: Array<{
    imageId: string;
    filename: string;
    storageDeleted: boolean;
    dbDeleted: boolean;
    error?: string;
  }>;
}> {
  const errors: string[] = [];
  const details: Array<any> = [];
  let deletedCount = 0;

  console.log(`🗑️ Starting auto-deletion of ${imagesToDelete.length} old images for user ${userId}`);

  for (const image of imagesToDelete) {
    const imageDetail = {
      imageId: image.id,
      filename: image.filename,
      storageDeleted: false,
      dbDeleted: false,
    };

    try {
      // 1. Supabase Storageから画像ファイルを削除
      if (image.storage_path) {
        console.log(`🗑️ Deleting from storage: ${image.storage_path}`);
        
        // private-imagesバケットとpublic-imagesバケット両方試行
        const buckets = ['private-images', 'public-images', 'images'];
        let storageDeleted = false;

        for (const bucket of buckets) {
          try {
            const { error: storageError } = await supabase.storage
              .from(bucket)
              .remove([image.storage_path]);

            if (!storageError) {
              imageDetail.storageDeleted = true;
              storageDeleted = true;
              console.log(`✅ Storage file deleted from ${bucket}: ${image.storage_path}`);
              break;
            }
          } catch (bucketError) {
            // このバケットでは見つからない場合、次のバケットを試行
            continue;
          }
        }

        if (!storageDeleted) {
          console.warn(`⚠️ Storage file not found in any bucket: ${image.storage_path}`);
          // ストレージファイルが見つからない場合は削除済みとみなす
          imageDetail.storageDeleted = true;
        }
      } else {
        // storage_pathがない場合（Base64のみの場合など）
        imageDetail.storageDeleted = true;
        console.log(`ℹ️ No storage path for image: ${image.filename}`);
      }

      // 2. データベースレコードを削除
      console.log(`🗑️ Deleting from database: ${image.id}`);
      const { error: dbError } = await supabase
        .from('generated_images') // AI生成画像テーブル
        .delete()
        .eq('id', image.id)
        .eq('user_id', userId); // セキュリティのため再確認

      if (dbError) {
        console.error(`❌ DB deletion failed (${image.id}):`, dbError);
        imageDetail.error = `DB削除失敗: ${dbError.message}`;
        errors.push(`レコード削除失敗: ${image.filename}`);
      } else {
        imageDetail.dbDeleted = true;
        deletedCount++;
        console.log(`✅ Database record deleted: ${image.filename} (${image.id})`);
      }

      details.push(imageDetail);

    } catch (error) {
      console.error(`❌ Error during image deletion (${image.id}):`, error);
      imageDetail.error = error instanceof Error ? error.message : '不明なエラー';
      errors.push(`削除エラー: ${image.filename}`);
      details.push(imageDetail);
    }
  }

  const allSuccessful = errors.length === 0;
  
  console.log(`🗑️ Auto-deletion completed: ${deletedCount}/${imagesToDelete.length} images deleted successfully`);
  if (errors.length > 0) {
    console.warn(`⚠️ Deletion errors:`, errors);
  }

  return {
    success: allSuccessful,
    deletedCount,
    errors,
    details
  };
}

/**
 * 画像保存前の事前処理（制限チェック+古い画像削除）
 */
export async function prepareForImageSave(userId: string): Promise<{
  canProceed: boolean;
  message?: string;
  deletedCount?: number;
  errors?: string[];
}> {
  try {
    // 制限チェック
    const limitResult = await checkImageLimit(userId);

    if (!limitResult.canSave) {
      return {
        canProceed: false,
        message: limitResult.message || '画像の保存制限に達しています'
      };
    }

    // 削除対象がある場合は削除実行
    if (limitResult.imagesToDelete.length > 0) {
      const deleteResult = await deleteOldImages(userId, limitResult.imagesToDelete);

      if (!deleteResult.success) {
        return {
          canProceed: false,
          message: '古い画像の削除に失敗しました',
          errors: deleteResult.errors
        };
      }

      return {
        canProceed: true,
        message: `古い画像${deleteResult.deletedCount}枚を削除しました。新しい画像を保存できます。`,
        deletedCount: deleteResult.deletedCount
      };
    }

    // 制限内で削除不要の場合
    return {
      canProceed: true,
      message: `画像を保存できます（${limitResult.currentCount}/${limitResult.limit}枚）`
    };

  } catch (error) {
    console.error('画像保存準備中にエラーが発生:', error);
    return {
      canProceed: false,
      message: '画像保存の準備中にエラーが発生しました'
    };
  }
}

/**
 * 手動での古い画像クリーンアップ
 */
export async function cleanupOldImages(userId: string, keepCount?: number): Promise<{
  success: boolean;
  message: string;
  deletedCount: number;
  errors: string[];
}> {
  try {
    const limit = keepCount || getImageLimit(userId);
    
    if (limit === -1) {
      return {
        success: true,
        message: 'Proプランユーザーは画像数制限がないため、クリーンアップは不要です。',
        deletedCount: 0,
        errors: []
      };
    }

    const limitResult = await checkImageLimit(userId);
    
    if (limitResult.imagesToDelete.length === 0) {
      return {
        success: true,
        message: `画像数は制限内です（${limitResult.currentCount}/${limit}枚）。削除の必要はありません。`,
        deletedCount: 0,
        errors: []
      };
    }

    const deleteResult = await deleteOldImages(userId, limitResult.imagesToDelete);

    return {
      success: deleteResult.success,
      message: deleteResult.success 
        ? `古い画像${deleteResult.deletedCount}枚を削除しました。`
        : `削除に失敗しました。エラー: ${deleteResult.errors.join(', ')}`,
      deletedCount: deleteResult.deletedCount,
      errors: deleteResult.errors
    };

  } catch (error) {
    console.error('画像クリーンアップ中にエラーが発生:', error);
    return {
      success: false,
      message: 'クリーンアップ中にエラーが発生しました',
      deletedCount: 0,
      errors: [error instanceof Error ? error.message : '不明なエラー']
    };
  }
}

/**
 * ユーザーの画像保存統計を取得
 */
export async function getImageStorageStats(userId: string): Promise<{
  currentCount: number;
  limit: number;
  remainingSlots: number;
  usagePercentage: number;
  canSaveMore: boolean;
  planName: string;
}> {
  try {
    const currentCount = await getCurrentImageCount(userId);
    const limit = getImageLimit(userId);
    const subscription = getUserSubscription(userId);

    if (limit === -1) {
      // 無制限プラン
      return {
        currentCount,
        limit: -1,
        remainingSlots: -1,
        usagePercentage: 0,
        canSaveMore: true,
        planName: subscription.plan
      };
    }

    const remainingSlots = Math.max(0, limit - currentCount);
    const usagePercentage = (currentCount / limit) * 100;

    return {
      currentCount,
      limit,
      remainingSlots,
      usagePercentage: Math.round(usagePercentage * 100) / 100,
      canSaveMore: currentCount < limit,
      planName: subscription.plan
    };

  } catch (error) {
    console.error('画像統計取得中にエラーが発生:', error);
    const limit = getImageLimit(userId);
    return {
      currentCount: 0,
      limit,
      remainingSlots: limit === -1 ? -1 : limit,
      usagePercentage: 0,
      canSaveMore: true,
      planName: 'free'
    };
  }
}

/**
 * React Hook: 画像制限の管理
 */
import { useState, useEffect } from 'react';

export function useImageLimit(userId: string) {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getImageStorageStats>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const newStats = await getImageStorageStats(userId);
      setStats(newStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : '統計の取得に失敗しました');
      console.error('Image limit stats error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      refreshStats();
    }
  }, [userId]);

  const prepareForSave = async () => {
    if (!userId) return { canProceed: false, message: 'ユーザーIDが不明です' };
    
    const result = await prepareForImageSave(userId);
    if (result.canProceed) {
      // 統計を更新
      await refreshStats();
    }
    return result;
  };

  const cleanup = async (keepCount?: number) => {
    if (!userId) return { success: false, message: 'ユーザーIDが不明です', deletedCount: 0, errors: [] };
    
    const result = await cleanupOldImages(userId, keepCount);
    if (result.success) {
      // 統計を更新
      await refreshStats();
    }
    return result;
  };

  return {
    stats,
    isLoading,
    error,
    refreshStats,
    prepareForSave,
    cleanup
  };
}