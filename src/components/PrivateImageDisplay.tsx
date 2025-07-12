'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSignedUrl, SignedUrlResult } from '@/lib/privateImageStorage';

interface PrivateImageDisplayProps {
  filePath: string;
  userId: string;
  alt?: string;
  className?: string;
  fallbackSrc?: string;
  onError?: (error: string) => void;
  expiresIn?: number; // 署名付きURLの有効期限（秒）
  autoRefresh?: boolean; // 期限切れ前に自動更新するか
}

interface ImageState {
  signedUrl: string | null;
  loading: boolean;
  error: string | null;
  expiresAt: Date | null;
}

export default function PrivateImageDisplay({
  filePath,
  userId,
  alt = 'Private Image',
  className = '',
  fallbackSrc,
  onError,
  expiresIn = 300, // デフォルト5分
  autoRefresh = true
}: PrivateImageDisplayProps) {
  const [imageState, setImageState] = useState<ImageState>({
    signedUrl: null,
    loading: true,
    error: null,
    expiresAt: null
  });

  // 署名付きURLを取得
  const fetchSignedUrl = useCallback(async () => {
    if (!filePath) {
      setImageState(prev => ({
        ...prev,
        loading: false,
        error: 'ファイルパスが指定されていません'
      }));
      return;
    }

    setImageState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/images/signed-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

      setImageState({
        signedUrl: result.signedUrl,
        loading: false,
        error: null,
        expiresAt: new Date(result.expiresAt)
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      setImageState({
        signedUrl: null,
        loading: false,
        error: errorMessage,
        expiresAt: null
      });
      onError?.(errorMessage);
    }
  }, [filePath, userId, expiresIn, onError]);

  // 初回ロード
  useEffect(() => {
    fetchSignedUrl();
  }, [fetchSignedUrl]);

  // 自動更新機能
  useEffect(() => {
    if (!autoRefresh || !imageState.expiresAt) return;

    // 有効期限の30秒前に更新
    const refreshTime = imageState.expiresAt.getTime() - Date.now() - 30000;
    
    if (refreshTime > 0) {
      const timeout = setTimeout(() => {
        console.log('🔄 Refreshing signed URL before expiration');
        fetchSignedUrl();
      }, refreshTime);

      return () => clearTimeout(timeout);
    }
  }, [imageState.expiresAt, autoRefresh, fetchSignedUrl]);

  // 画像読み込みエラーハンドリング
  const handleImageError = useCallback(() => {
    console.warn('🖼️ Image failed to load, attempting to refresh signed URL');
    fetchSignedUrl();
  }, [fetchSignedUrl]);

  // 手動リフレッシュ
  const handleRefresh = useCallback(() => {
    fetchSignedUrl();
  }, [fetchSignedUrl]);

  // ローディング状態
  if (imageState.loading) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center justify-center bg-gray-100 rounded-lg animate-pulse">
          <div className="text-gray-400 p-8">
            <svg className="w-8 h-8 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm">読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  // エラー状態
  if (imageState.error) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex flex-col items-center justify-center bg-red-50 border border-red-200 rounded-lg p-8">
          <div className="text-red-400 mb-2">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-red-600 text-sm text-center mb-3">{imageState.error}</p>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm transition-colors"
          >
            再試行
          </button>
        </div>
        {fallbackSrc && (
          <img
            src={fallbackSrc}
            alt={alt}
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
        )}
      </div>
    );
  }

  // 画像表示
  return (
    <div className={`relative ${className}`}>
      {imageState.signedUrl && (
        <img
          src={imageState.signedUrl}
          alt={alt}
          className="w-full h-full object-cover"
          onError={handleImageError}
          loading="lazy"
        />
      )}
      
      {/* 期限表示（開発時のみ） */}
      {process.env.NODE_ENV === 'development' && imageState.expiresAt && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
          期限: {imageState.expiresAt.toLocaleTimeString()}
        </div>
      )}
      
      {/* リフレッシュボタン（ホバー時表示） */}
      <div className="absolute top-2 left-2 opacity-0 hover:opacity-100 transition-opacity">
        <button
          onClick={handleRefresh}
          className="bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-1 rounded text-xs"
          title="画像を更新"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// 複数画像用のグリッド表示コンポーネント
interface PrivateImageGridProps {
  images: Array<{
    filePath: string;
    userId: string;
    alt?: string;
    metadata?: any;
  }>;
  className?: string;
  onImageClick?: (image: any) => void;
  expiresIn?: number;
}

export function PrivateImageGrid({
  images,
  className = '',
  onImageClick,
  expiresIn = 300
}: PrivateImageGridProps) {
  if (!images || images.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-gray-400 mb-2">
          <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-gray-500">画像がありません</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${className}`}>
      {images.map((image, index) => (
        <div
          key={`${image.filePath}-${index}`}
          className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => onImageClick?.(image)}
        >
          <PrivateImageDisplay
            filePath={image.filePath}
            userId={image.userId}
            alt={image.alt || `Image ${index + 1}`}
            className="w-full h-full"
            expiresIn={expiresIn}
          />
          
          {/* オーバーレイ */}
          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 flex items-end">
            <div className="p-2 w-full bg-gradient-to-t from-black to-transparent opacity-0 hover:opacity-100 transition-opacity">
              <p className="text-white text-xs truncate">
                {image.metadata?.prompt || 'Generated Image'}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}