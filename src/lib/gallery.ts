import { supabase } from './supabase';

// 生成画像のデータ型定義
export interface GeneratedImage {
  id?: string;
  user_id: string;
  prompt: string;
  pose_data: any; // JSONポーズデータ
  image_url?: string;
  image_base64?: string;
  is_commercial: boolean;
  resolution: string; // '512x512'
  style: string;
  background: string;
  processing_time?: number;
  created_at?: string;
  updated_at?: string;
}

// モックデータ（localStorage用）
const MOCK_GALLERY_DATA: GeneratedImage[] = [
  {
    id: '1',
    user_id: 'guest',
    prompt: '美しい花畑で踊っている女性',
    pose_data: {
      keypoints: [
        { name: 'left_shoulder', x: 0.4, y: 0.25 },
        { name: 'right_shoulder', x: 0.6, y: 0.25 },
        { name: 'left_elbow', x: 0.3, y: 0.2 },
        { name: 'right_elbow', x: 0.7, y: 0.2 }
      ]
    },
    image_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    is_commercial: false,
    resolution: '512x512',
    style: 'リアル',
    background: '自然',
    processing_time: 2345,
    created_at: '2024-07-01T10:30:00Z'
  },
  {
    id: '2',
    user_id: 'guest',
    prompt: 'サイバーパンクなロボットがポーズを取っている',
    pose_data: {
      keypoints: [
        { name: 'left_shoulder', x: 0.35, y: 0.3 },
        { name: 'right_shoulder', x: 0.65, y: 0.3 },
        { name: 'left_elbow', x: 0.2, y: 0.4 },
        { name: 'right_elbow', x: 0.8, y: 0.4 }
      ]
    },
    image_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    is_commercial: true,
    resolution: '512x512',
    style: 'アニメ',
    background: '透明',
    processing_time: 1876,
    created_at: '2024-06-30T15:45:00Z'
  },
  {
    id: '3',
    user_id: 'guest',
    prompt: 'ヨガのポーズをしている人',
    pose_data: {
      keypoints: [
        { name: 'left_shoulder', x: 0.45, y: 0.25 },
        { name: 'right_shoulder', x: 0.55, y: 0.25 },
        { name: 'left_knee', x: 0.4, y: 0.6 },
        { name: 'right_knee', x: 0.6, y: 0.6 }
      ]
    },
    image_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    is_commercial: false,
    resolution: '512x512',
    style: 'イラスト',
    background: 'スタジオ',
    processing_time: 3021,
    created_at: '2024-06-29T09:15:00Z'
  }
];

const GALLERY_STORAGE_KEY = 'ai-pose-editor-gallery';

// ゲストユーザーのギャラリーデータをlocalStorageから取得
export function getGuestGallery(): GeneratedImage[] {
  if (typeof window === 'undefined') {
    return MOCK_GALLERY_DATA;
  }
  
  try {
    const stored = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (!stored) {
      // 初回はモックデータを設定
      localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(MOCK_GALLERY_DATA));
      return MOCK_GALLERY_DATA;
    }
    
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error reading gallery from localStorage:', error);
    return MOCK_GALLERY_DATA;
  }
}

// ゲストユーザーのギャラリーに画像を追加
export function addToGuestGallery(image: Omit<GeneratedImage, 'id' | 'created_at'>): GeneratedImage {
  const gallery = getGuestGallery();
  
  const newImage: GeneratedImage = {
    ...image,
    id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString()
  };
  
  gallery.unshift(newImage); // 新しい画像を先頭に追加
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(gallery));
  }
  
  return newImage;
}

// ゲストユーザーのギャラリーから画像を削除
export function removeFromGuestGallery(imageId: string): boolean {
  const gallery = getGuestGallery();
  const updatedGallery = gallery.filter(img => img.id !== imageId);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(updatedGallery));
  }
  
  return gallery.length !== updatedGallery.length;
}

// ユーザーのギャラリーを取得（Supabase版）
export async function getUserGallery(userId: string): Promise<GeneratedImage[]> {
  try {
    const { data, error } = await supabase
      .from('generated_images')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching user gallery:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getUserGallery:', error);
    return [];
  }
}

// 画像をデータベースに保存（Supabase版）
export async function saveImageToDatabase(image: Omit<GeneratedImage, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; data?: GeneratedImage; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('generated_images')
      .insert([{
        ...image,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
      
    if (error) {
      console.error('Error saving image to database:', error);
      return {
        success: false,
        error: '画像の保存に失敗しました'
      };
    }
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('Error in saveImageToDatabase:', error);
    return {
      success: false,
      error: '予期しないエラーが発生しました'
    };
  }
}

// 画像をデータベースから削除（Supabase版）
export async function deleteImageFromDatabase(userId: string, imageId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('generated_images')
      .delete()
      .eq('id', imageId)
      .eq('user_id', userId); // セキュリティのためのuser_idチェック
      
    if (error) {
      console.error('Error deleting image from database:', error);
      return {
        success: false,
        error: '画像の削除に失敗しました'
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in deleteImageFromDatabase:', error);
    return {
      success: false,
      error: '予期しないエラーが発生しました'
    };
  }
}

// ユーザーの統計情報を取得
export async function getGalleryStats(userId?: string): Promise<{
  totalImages: number;
  commercialImages: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
}> {
  let images: GeneratedImage[] = [];
  
  if (userId) {
    images = await getUserGallery(userId);
  } else {
    images = getGuestGallery();
  }
  
  const stats = images.reduce((acc, img) => {
    acc.totalImages++;
    if (img.is_commercial) acc.commercialImages++;
    if (img.processing_time) acc.totalProcessingTime += img.processing_time;
    return acc;
  }, {
    totalImages: 0,
    commercialImages: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0
  });
  
  stats.averageProcessingTime = stats.totalImages > 0 
    ? Math.round(stats.totalProcessingTime / stats.totalImages)
    : 0;
  
  return stats;
}