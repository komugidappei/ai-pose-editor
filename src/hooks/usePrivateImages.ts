// プライベート画像管理用のReactフック
// 画像一覧取得、署名付きURL生成、削除などを簡単に使用

import { useState, useEffect, useCallback } from 'react';

// 画像データの型定義
export interface PrivateImage {
  name: string;
  filePath: string;
  size: number;
  created_at: string;
  updated_at: string;
  metadata?: any;
  signedUrl?: string;
  signedUrlExpiresAt?: Date;
}

// 統計情報の型定義
export interface ImageStats {
  totalFiles: number;
  totalSize: number;
  formattedSize: string;
}

// フックの戻り値型定義
export interface UsePrivateImagesReturn {
  images: PrivateImage[];
  loading: boolean;
  error: string | null;
  stats: ImageStats | null;
  hasMore: boolean;
  
  // 操作関数
  loadImages: (options?: LoadOptions) => Promise<void>;
  loadMore: () => Promise<void>;
  refreshImages: () => Promise<void>;
  getSignedUrl: (filePath: string) => Promise<string | null>;
  deleteImage: (filePath: string) => Promise<boolean>;
  clearError: () => void;
}

// 読み込みオプション
export interface LoadOptions {
  folder?: string;
  limit?: number;
  includeStats?: boolean;
  search?: string;
  sortBy?: 'created_at' | 'name' | 'size';
  sortOrder?: 'asc' | 'desc';
}

/**
 * プライベート画像管理フック
 */
export function usePrivateImages(
  userId: string,
  initialOptions: LoadOptions = {}
): UsePrivateImagesReturn {
  const [images, setImages] = useState<PrivateImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ImageStats | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<LoadOptions>({
    folder: 'generated',
    limit: 20,
    includeStats: false,
    sortBy: 'created_at',
    sortOrder: 'desc',
    ...initialOptions
  });

  /**
   * 画像一覧を読み込み
   */
  const loadImages = useCallback(async (options: LoadOptions = {}) => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const mergedOptions = { ...currentOptions, ...options };
      setCurrentOptions(mergedOptions);

      const response = await fetch('/api/images/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          userId,
          ...mergedOptions,
          offset: 0 // 新規読み込みの場合はoffsetをリセット
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '画像一覧の取得に失敗しました');
      }

      setImages(result.images || []);
      setStats(result.stats || null);
      setHasMore(result.pagination?.hasMore || false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました';
      setError(errorMessage);
      console.error('Load images error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, currentOptions]);

  /**
   * 追加の画像を読み込み（ページネーション）
   */
  const loadMore = useCallback(async () => {
    if (!userId || loading || !hasMore) return;

    setLoading(true);

    try {
      const response = await fetch('/api/images/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          userId,
          ...currentOptions,
          offset: images.length
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '追加画像の取得に失敗しました');
      }

      setImages(prev => [...prev, ...(result.images || [])]);
      setHasMore(result.pagination?.hasMore || false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました';
      setError(errorMessage);
      console.error('Load more images error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, loading, hasMore, images.length, currentOptions]);

  /**
   * 画像一覧を再読み込み
   */
  const refreshImages = useCallback(() => {
    return loadImages(currentOptions);
  }, [loadImages, currentOptions]);

  /**
   * 署名付きURLを取得（キャッシュ機能付き）
   */
  const getSignedUrl = useCallback(async (filePath: string): Promise<string | null> => {
    if (!userId || !filePath) return null;

    try {
      // 既存の署名付きURLが有効かチェック
      const existingImage = images.find(img => img.filePath === filePath);
      if (existingImage?.signedUrl && existingImage.signedUrlExpiresAt) {
        const now = new Date();
        const expiresAt = new Date(existingImage.signedUrlExpiresAt);
        
        // 期限の1分前までは既存URLを使用
        if (expiresAt.getTime() - now.getTime() > 60000) {
          return existingImage.signedUrl;
        }
      }

      // 新しい署名付きURLを取得
      const response = await fetch('/api/images/signed-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          filePath,
          userId,
          expiresIn: 300 // 5分間
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '署名付きURL取得に失敗しました');
      }

      // 画像リストのキャッシュを更新
      setImages(prev => prev.map(img => 
        img.filePath === filePath 
          ? {
              ...img,
              signedUrl: result.signedUrl,
              signedUrlExpiresAt: new Date(result.expiresAt)
            }
          : img
      ));

      return result.signedUrl;

    } catch (err) {
      console.error('Get signed URL error:', err);
      return null;
    }
  }, [userId, images]);

  /**
   * 画像を削除
   */
  const deleteImage = useCallback(async (filePath: string): Promise<boolean> => {
    if (!userId || !filePath) return false;

    try {
      const response = await fetch('/api/images/list', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          userId,
          filePath
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '画像削除に失敗しました');
      }

      // ローカルの画像リストから削除
      setImages(prev => prev.filter(img => img.filePath !== filePath));
      
      // 統計情報を更新
      if (stats) {
        const deletedImage = images.find(img => img.filePath === filePath);
        if (deletedImage) {
          setStats(prev => prev ? {
            ...prev,
            totalFiles: prev.totalFiles - 1,
            totalSize: prev.totalSize - deletedImage.size,
            formattedSize: formatBytes(prev.totalSize - deletedImage.size)
          } : null);
        }
      }

      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました';
      setError(errorMessage);
      console.error('Delete image error:', err);
      return false;
    }
  }, [userId, images, stats]);

  /**
   * エラーをクリア
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 初回読み込み
  useEffect(() => {
    if (userId) {
      loadImages();
    }
  }, [userId]); // loadImagesは除外（無限ループ防止）

  return {
    images,
    loading,
    error,
    stats,
    hasMore,
    loadImages,
    loadMore,
    refreshImages,
    getSignedUrl,
    deleteImage,
    clearError
  };
}

/**
 * 単一画像の署名付きURL管理フック
 */
export function useSignedUrl(filePath: string, userId: string, expiresIn: number = 300) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  const fetchSignedUrl = useCallback(async () => {
    if (!filePath || !userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/images/signed-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          filePath,
          userId,
          expiresIn
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '署名付きURL取得に失敗しました');
      }

      setSignedUrl(result.signedUrl);
      setExpiresAt(new Date(result.expiresAt));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました';
      setError(errorMessage);
      console.error('Fetch signed URL error:', err);
    } finally {
      setLoading(false);
    }
  }, [filePath, userId, expiresIn]);

  // 自動更新機能
  useEffect(() => {
    if (!expiresAt) return;

    // 期限の30秒前に更新
    const refreshTime = expiresAt.getTime() - Date.now() - 30000;
    
    if (refreshTime > 0) {
      const timeout = setTimeout(() => {
        console.log('🔄 Auto-refreshing signed URL');
        fetchSignedUrl();
      }, refreshTime);

      return () => clearTimeout(timeout);
    }
  }, [expiresAt, fetchSignedUrl]);

  // 初回読み込み
  useEffect(() => {
    fetchSignedUrl();
  }, [fetchSignedUrl]);

  return {
    signedUrl,
    loading,
    error,
    expiresAt,
    refresh: fetchSignedUrl,
    clearError: () => setError(null)
  };
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