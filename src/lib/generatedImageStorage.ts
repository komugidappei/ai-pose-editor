// AI生成画像の保存と制限管理
// 10枚制限に達した場合の自動削除処理を含む

import { supabase } from './supabase';
import { prepareForImageSave, getImageStorageStats } from './imageLimit';

export interface GeneratedImageData {
  user_id: string;
  prompt: string;
  pose_data: any;
  image_url?: string;
  image_base64?: string;
  is_commercial?: boolean;
  resolution?: string;
  style?: string;
  background?: string;
  processing_time?: number;
  ai_style_id?: string;
}

export interface ImageSaveResult {
  success: boolean;
  imageId?: string;
  deletedOldImages?: number;
  message?: string;
  error?: string;
  stats?: {
    currentCount: number;
    limit: number;
    canSaveMore: boolean;
  };
}

/**
 * AI生成画像を保存（10枚制限の自動削除付き）
 */
export async function saveGeneratedImage(
  imageData: GeneratedImageData
): Promise<ImageSaveResult> {
  try {
    console.log(`💾 Saving generated image for user: ${imageData.user_id}`);

    // 1. 保存前の制限チェックと古い画像の自動削除
    const prepareResult = await prepareForImageSave(imageData.user_id);
    
    if (!prepareResult.canProceed) {
      console.error('❌ Cannot save image:', prepareResult.message);
      return {
        success: false,
        error: prepareResult.message || '画像の保存制限により保存できません',
      };
    }

    // 削除された画像がある場合はログ出力
    if (prepareResult.deletedCount && prepareResult.deletedCount > 0) {
      console.log(`🗑️ Auto-deleted ${prepareResult.deletedCount} old images to make space`);
    }

    // 2. generated_imagesテーブルに新しい画像を保存
    const { data: savedImage, error } = await supabase
      .from('generated_images')
      .insert({
        user_id: imageData.user_id,
        prompt: imageData.prompt,
        pose_data: imageData.pose_data,
        image_url: imageData.image_url,
        image_base64: imageData.image_base64,
        is_commercial: imageData.is_commercial || false,
        resolution: imageData.resolution || '512x512',
        style: imageData.style || 'リアル',
        background: imageData.background || '透明',
        processing_time: imageData.processing_time,
        ai_style_id: imageData.ai_style_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Database save failed:', error);
      return {
        success: false,
        error: `データベース保存エラー: ${error.message}`,
      };
    }

    // 3. 保存後の統計情報を取得
    const stats = await getImageStorageStats(imageData.user_id);

    console.log(`✅ Generated image saved successfully:`, {
      imageId: savedImage.id,
      deletedOldImages: prepareResult.deletedCount,
      currentCount: stats.currentCount,
      limit: stats.limit,
    });

    return {
      success: true,
      imageId: savedImage.id,
      deletedOldImages: prepareResult.deletedCount,
      message: prepareResult.deletedCount 
        ? `画像を保存しました。古い画像${prepareResult.deletedCount}枚を自動削除しました。`
        : '画像を保存しました。',
      stats: {
        currentCount: stats.currentCount,
        limit: stats.limit,
        canSaveMore: stats.canSaveMore,
      },
    };

  } catch (error) {
    console.error('❌ Error saving generated image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '画像保存中に予期しないエラーが発生しました',
    };
  }
}

/**
 * 特定のAI生成画像を削除
 */
export async function deleteGeneratedImage(
  userId: string,
  imageId: string
): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    console.log(`🗑️ Deleting generated image: ${imageId} for user: ${userId}`);

    // 画像情報を取得
    const { data: image, error: fetchError } = await supabase
      .from('generated_images')
      .select('id, prompt, image_url')
      .eq('id', imageId)
      .eq('user_id', userId) // セキュリティチェック
      .single();

    if (fetchError || !image) {
      return {
        success: false,
        message: '画像が見つかりません',
        error: fetchError?.message,
      };
    }

    // Storageからファイルを削除（image_urlがある場合）
    if (image.image_url) {
      const buckets = ['private-images', 'public-images'];
      for (const bucket of buckets) {
        try {
          const { error: storageError } = await supabase.storage
            .from(bucket)
            .remove([image.image_url]);
          
          if (!storageError) {
            console.log(`✅ Storage file deleted from ${bucket}: ${image.image_url}`);
            break;
          }
        } catch {
          // 次のバケットを試行
          continue;
        }
      }
    }

    // データベースから削除
    const { error: deleteError } = await supabase
      .from('generated_images')
      .delete()
      .eq('id', imageId)
      .eq('user_id', userId);

    if (deleteError) {
      return {
        success: false,
        message: 'データベースからの削除に失敗しました',
        error: deleteError.message,
      };
    }

    console.log(`✅ Generated image deleted successfully: ${imageId}`);

    return {
      success: true,
      message: '画像を削除しました',
    };

  } catch (error) {
    console.error('❌ Error deleting generated image:', error);
    return {
      success: false,
      message: '画像削除中にエラーが発生しました',
      error: error instanceof Error ? error.message : '不明なエラー',
    };
  }
}

/**
 * ユーザーの生成画像一覧を取得
 */
export async function getUserGeneratedImages(
  userId: string,
  limit?: number,
  offset?: number
): Promise<{
  success: boolean;
  images: any[];
  totalCount: number;
  error?: string;
}> {
  try {
    const query = supabase
      .from('generated_images')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (limit) {
      query.limit(limit);
    }
    if (offset) {
      query.range(offset, offset + (limit || 10) - 1);
    }

    const { data: images, error, count } = await query;

    if (error) {
      return {
        success: false,
        images: [],
        totalCount: 0,
        error: error.message,
      };
    }

    return {
      success: true,
      images: images || [],
      totalCount: count || 0,
    };

  } catch (error) {
    console.error('Error fetching generated images:', error);
    return {
      success: false,
      images: [],
      totalCount: 0,
      error: error instanceof Error ? error.message : '不明なエラー',
    };
  }
}

/**
 * 特定の生成画像の詳細を取得
 */
export async function getGeneratedImageById(
  userId: string,
  imageId: string
): Promise<{
  success: boolean;
  image?: any;
  error?: string;
}> {
  try {
    const { data: image, error } = await supabase
      .from('generated_images')
      .select('*')
      .eq('id', imageId)
      .eq('user_id', userId)
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      image,
    };

  } catch (error) {
    console.error('Error fetching generated image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー',
    };
  }
}

/**
 * バッチでの古い画像クリーンアップ（管理者用）
 */
export async function batchCleanupOldImages(
  maxImagesPerUser: number = 10
): Promise<{
  success: boolean;
  processedUsers: number;
  totalDeletedImages: number;
  errors: Array<{ userId: string; error: string }>;
}> {
  try {
    console.log(`🧹 Starting batch cleanup with limit: ${maxImagesPerUser} images per user`);

    // すべてのユーザーの画像数を取得
    const { data: userImageCounts } = await supabase
      .from('generated_images')
      .select('user_id')
      .then(({ data }) => {
        if (!data) return { data: [] };
        const counts = new Map<string, number>();
        data.forEach(row => {
          counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1);
        });
        return { 
          data: Array.from(counts.entries())
            .filter(([_, count]) => count > maxImagesPerUser)
            .map(([userId, count]) => ({ user_id: userId, count }))
        };
      });

    let processedUsers = 0;
    let totalDeletedImages = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (const userInfo of userImageCounts || []) {
      try {
        const prepareResult = await prepareForImageSave(userInfo.user_id);
        if (prepareResult.deletedCount) {
          totalDeletedImages += prepareResult.deletedCount;
          console.log(`🗑️ Cleaned up ${prepareResult.deletedCount} images for user: ${userInfo.user_id}`);
        }
        processedUsers++;
      } catch (error) {
        errors.push({
          userId: userInfo.user_id,
          error: error instanceof Error ? error.message : '不明なエラー',
        });
      }
    }

    console.log(`🧹 Batch cleanup completed: ${processedUsers} users processed, ${totalDeletedImages} images deleted`);

    return {
      success: errors.length === 0,
      processedUsers,
      totalDeletedImages,
      errors,
    };

  } catch (error) {
    console.error('❌ Batch cleanup failed:', error);
    return {
      success: false,
      processedUsers: 0,
      totalDeletedImages: 0,
      errors: [{ userId: 'all', error: error instanceof Error ? error.message : '不明なエラー' }],
    };
  }
}