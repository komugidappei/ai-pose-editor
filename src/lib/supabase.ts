import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-supabase-url';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// データベーステーブルの型定義
export interface UserUsage {
  id?: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  image_generation_count: number;
  pose_extraction_count: number;
  commercial_use_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface UsageLimits {
  image_generation: number;
  pose_extraction: number;
  commercial_use: number;
}

// デフォルトの使用制限
export const DEFAULT_USAGE_LIMITS: UsageLimits = {
  image_generation: 10,
  pose_extraction: 5,
  commercial_use: 2,
};

// ユーザーの今日の使用回数を取得
export async function getUserUsageToday(userId: string): Promise<UserUsage | null> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const { data, error } = await supabase
    .from('user_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();
    
  if (error && error.code !== 'PGRST116') { // PGRST116 = 行が見つからない
    console.error('Error fetching user usage:', error);
    return null;
  }
  
  return data;
}

// ユーザーの使用回数を初期化（今日のレコードがない場合）
export async function initializeUserUsageToday(userId: string): Promise<UserUsage> {
  const today = new Date().toISOString().split('T')[0];
  
  const newUsage: Omit<UserUsage, 'id' | 'created_at' | 'updated_at'> = {
    user_id: userId,
    date: today,
    image_generation_count: 0,
    pose_extraction_count: 0,
    commercial_use_count: 0,
  };
  
  const { data, error } = await supabase
    .from('user_usage')
    .insert([newUsage])
    .select()
    .single();
    
  if (error) {
    console.error('Error initializing user usage:', error);
    throw error;
  }
  
  return data;
}

// 使用回数をインクリメント
export async function incrementUsage(
  userId: string, 
  type: keyof Omit<UserUsage, 'id' | 'user_id' | 'date' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; currentUsage?: UserUsage; error?: string }> {
  try {
    // 今日の使用回数を取得
    let usage = await getUserUsageToday(userId);
    
    // 今日のレコードがない場合は初期化
    if (!usage) {
      usage = await initializeUserUsageToday(userId);
    }
    
    // 使用制限をチェック
    const currentCount = usage[type];
    const limit = DEFAULT_USAGE_LIMITS[type as keyof UsageLimits];
    
    if (currentCount >= limit) {
      return {
        success: false,
        error: `今日の${getUsageTypeName(type)}制限（${limit}回）に達しました。`
      };
    }
    
    // カウントをインクリメント
    const updateData = {
      [type]: currentCount + 1,
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('user_usage')
      .update(updateData)
      .eq('id', usage.id)
      .select()
      .single();
      
    if (error) {
      console.error('Error incrementing usage:', error);
      return {
        success: false,
        error: '使用回数の更新に失敗しました。'
      };
    }
    
    return {
      success: true,
      currentUsage: data
    };
    
  } catch (error) {
    console.error('Error in incrementUsage:', error);
    return {
      success: false,
      error: '予期しないエラーが発生しました。'
    };
  }
}

// 使用回数をチェック（インクリメントなし）
export async function checkUsageLimit(
  userId: string, 
  type: keyof Omit<UserUsage, 'id' | 'user_id' | 'date' | 'created_at' | 'updated_at'>
): Promise<{ canUse: boolean; currentCount: number; limit: number; error?: string }> {
  try {
    let usage = await getUserUsageToday(userId);
    
    if (!usage) {
      usage = await initializeUserUsageToday(userId);
    }
    
    const currentCount = usage[type];
    const limit = DEFAULT_USAGE_LIMITS[type as keyof UsageLimits];
    
    return {
      canUse: currentCount < limit,
      currentCount,
      limit
    };
    
  } catch (error) {
    console.error('Error checking usage limit:', error);
    return {
      canUse: false,
      currentCount: 0,
      limit: 0,
      error: '使用制限の確認に失敗しました。'
    };
  }
}

// 使用タイプの日本語名を取得
function getUsageTypeName(type: string): string {
  switch (type) {
    case 'image_generation_count':
      return '画像生成';
    case 'pose_extraction_count':
      return 'ポーズ抽出';
    case 'commercial_use_count':
      return '商用利用';
    default:
      return '使用';
  }
}

// ユーザーの統計情報を取得
export async function getUserStats(userId: string): Promise<{
  totalImageGeneration: number;
  totalPoseExtraction: number;
  totalCommercialUse: number;
  daysActive: number;
}> {
  const { data, error } = await supabase
    .from('user_usage')
    .select('*')
    .eq('user_id', userId);
    
  if (error) {
    console.error('Error fetching user stats:', error);
    return {
      totalImageGeneration: 0,
      totalPoseExtraction: 0,
      totalCommercialUse: 0,
      daysActive: 0
    };
  }
  
  const stats = data.reduce((acc, usage) => {
    acc.totalImageGeneration += usage.image_generation_count;
    acc.totalPoseExtraction += usage.pose_extraction_count;
    acc.totalCommercialUse += usage.commercial_use_count;
    return acc;
  }, {
    totalImageGeneration: 0,
    totalPoseExtraction: 0,
    totalCommercialUse: 0,
    daysActive: data.length
  });
  
  return stats;
}

// ====================
// Row Level Security (RLS) ヘルパー関数
// ====================

/**
 * 現在のユーザーIDを取得
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * ユーザーが認証されているかチェック
 */
export async function isAuthenticated(): Promise<boolean> {
  const userId = await getCurrentUserId();
  return userId !== null;
}

/**
 * セキュアなデータベースクエリヘルパー
 * RLSポリシーを考慮した安全なクエリを実行
 */
export class SecureQuery {
  /**
   * 自分の画像のみを取得
   */
  static async getMyImages() {
    const { data, error } = await supabase
      .from('generated_images')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching images:', error);
      return { data: null, error };
    }
    
    return { data, error: null };
  }

  /**
   * 自分の保存済みポーズのみを取得
   */
  static async getMySavedPoses() {
    const { data, error } = await supabase
      .from('saved_poses')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching saved poses:', error);
      return { data: null, error };
    }
    
    return { data, error: null };
  }

  /**
   * 画像を安全に挿入（自動的に現在のユーザーIDを設定）
   */
  static async insertImage(imageData: Omit<any, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { data: null, error: { message: 'ユーザーが認証されていません' } };
    }

    const { data, error } = await supabase
      .from('generated_images')
      .insert([{
        ...imageData,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    return { data, error };
  }

  /**
   * ポーズを安全に挿入（自動的に現在のユーザーIDを設定）
   */
  static async insertPose(poseData: Omit<any, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { data: null, error: { message: 'ユーザーが認証されていません' } };
    }

    const { data, error } = await supabase
      .from('saved_poses')
      .insert([{
        ...poseData,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    return { data, error };
  }

  /**
   * 自分のデータのみを更新
   */
  static async updateMyImage(imageId: string, updates: any) {
    const { data, error } = await supabase
      .from('generated_images')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', imageId)
      .select()
      .single();

    return { data, error };
  }

  /**
   * 自分のデータのみを削除
   */
  static async deleteMyImage(imageId: string) {
    const { data, error } = await supabase
      .from('generated_images')
      .delete()
      .eq('id', imageId)
      .select()
      .single();

    return { data, error };
  }
}

/**
 * RLSエラーハンドリング
 */
export function handleRLSError(error: any): {
  isRLSError: boolean;
  message: string;
  statusCode?: number;
} {
  if (!error) {
    return { isRLSError: false, message: '' };
  }

  // Supabase RLSエラーの検出
  if (error.code === 'PGRST301' || error.message?.includes('row-level security')) {
    return {
      isRLSError: true,
      message: 'アクセスが拒否されました。このデータにはアクセス権限がありません。',
      statusCode: 403
    };
  }

  if (error.code === 'PGRST116') {
    return {
      isRLSError: false,
      message: 'データが見つかりませんでした。',
      statusCode: 404
    };
  }

  return {
    isRLSError: false,
    message: error.message || '予期しないエラーが発生しました。',
    statusCode: 500
  };
}

/**
 * RLS対応のエラーハンドリング付きクエリラッパー
 */
export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<{
  data: T | null;
  error: string | null;
  statusCode?: number;
}> {
  try {
    const { data, error } = await queryFn();
    
    if (error) {
      const { message, statusCode } = handleRLSError(error);
      return { data: null, error: message, statusCode };
    }
    
    return { data, error: null };
  } catch (err) {
    const { message, statusCode } = handleRLSError(err);
    return { data: null, error: message, statusCode };
  }
}