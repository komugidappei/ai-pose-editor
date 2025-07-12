'use client';

import { useState, useCallback } from 'react';
import { usePrivateImages } from '@/hooks/usePrivateImages';
import PrivateImageDisplay, { PrivateImageGrid } from './PrivateImageDisplay';
import { SafePrompt, SafeError } from './SafeText';

interface ImageGalleryProps {
  userId: string;
  isAuthenticated?: boolean;
  onImageSelect?: (image: any) => void;
  className?: string;
}

interface ImageModalProps {
  image: any;
  userId: string;
  onClose: () => void;
  onDelete?: (filePath: string) => void;
}

// 画像詳細モーダル
function ImageModal({ image, userId, onClose, onDelete }: ImageModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete || !confirm('この画像を削除しますか？')) return;

    setDeleting(true);
    try {
      await onDelete(image.filePath);
      onClose();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold truncate"><SafePrompt>{image.name}</SafePrompt></h3>
          <div className="flex items-center space-x-2">
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm transition-colors disabled:opacity-50"
              >
                {deleting ? '削除中...' : '削除'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* 画像表示 */}
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            <div className="max-w-full max-h-[60vh] flex items-center justify-center bg-gray-50 rounded-lg">
              <PrivateImageDisplay
                filePath={image.filePath}
                userId={userId}
                alt={image.name}
                className="max-w-full max-h-full"
                expiresIn={600} // モーダル表示時は10分
              />
            </div>
          </div>
        </div>

        {/* メタデータ */}
        <div className="border-t p-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">ファイルサイズ:</span>
              <span className="ml-2">{formatBytes(image.size)}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">作成日時:</span>
              <span className="ml-2">{new Date(image.created_at).toLocaleString('ja-JP')}</span>
            </div>
            {image.metadata?.prompt && (
              <div className="md:col-span-2">
                <span className="font-medium text-gray-700">プロンプト:</span>
                <p className="mt-1 text-gray-600 bg-white p-2 rounded border text-sm">
                  <SafePrompt>{image.metadata.prompt}</SafePrompt>
                </p>
              </div>
            )}
            {image.metadata?.style && (
              <div>
                <span className="font-medium text-gray-700">スタイル:</span>
                <span className="ml-2"><SafePrompt>{image.metadata.style}</SafePrompt></span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ImageGallery({
  userId,
  isAuthenticated = false,
  onImageSelect,
  className = ''
}: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'name' | 'size'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const {
    images,
    loading,
    error,
    stats,
    hasMore,
    loadImages,
    loadMore,
    refreshImages,
    deleteImage,
    clearError
  } = usePrivateImages(userId, {
    limit: 12,
    includeStats: true,
    search: searchQuery,
    sortBy,
    sortOrder
  });

  // 検索・フィルタリング
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    loadImages({
      search: query,
      sortBy,
      sortOrder
    });
  }, [loadImages, sortBy, sortOrder]);

  // ソート変更
  const handleSortChange = useCallback((newSortBy: typeof sortBy, newSortOrder: typeof sortOrder) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    loadImages({
      search: searchQuery,
      sortBy: newSortBy,
      sortOrder: newSortOrder
    });
  }, [loadImages, searchQuery]);

  // 画像選択
  const handleImageClick = useCallback((image: any) => {
    setSelectedImage(image);
    onImageSelect?.(image);
  }, [onImageSelect]);

  // 画像削除
  const handleDeleteImage = useCallback(async (filePath: string) => {
    const success = await deleteImage(filePath);
    if (success) {
      // 統計情報を更新するため再読み込み
      setTimeout(() => refreshImages(), 100);
    }
    return success;
  }, [deleteImage, refreshImages]);

  // 認証されていない場合
  if (!isAuthenticated) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">ログインが必要です</h3>
        <p className="text-gray-600">画像ギャラリーを表示するにはログインしてください。</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">画像ギャラリー</h2>
          {stats && (
            <p className="text-sm text-gray-600">
              {stats.totalFiles}枚の画像 ({stats.formattedSize})
            </p>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={refreshImages}
            disabled={loading}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors disabled:opacity-50"
          >
            更新
          </button>
        </div>
      </div>

      {/* 検索・フィルター */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="画像を検索..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
              handleSortChange(newSortBy, newSortOrder);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="created_at-desc">新しい順</option>
            <option value="created_at-asc">古い順</option>
            <option value="name-asc">名前順</option>
            <option value="size-desc">サイズ大</option>
            <option value="size-asc">サイズ小</option>
          </select>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-red-600"><SafeError>{error}</SafeError></p>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 画像グリッド */}
      <PrivateImageGrid
        images={images.map(img => ({
          filePath: img.filePath,
          userId,
          alt: img.name,
          metadata: img.metadata
        }))}
        onImageClick={handleImageClick}
        expiresIn={300}
      />

      {/* もっと読み込みボタン */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? '読み込み中...' : 'もっと見る'}
          </button>
        </div>
      )}

      {/* ローディング状態 */}
      {loading && images.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-600">読み込み中...</p>
        </div>
      )}

      {/* 画像がない場合 */}
      {!loading && images.length === 0 && !error && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">画像がありません</h3>
          <p className="text-gray-600">最初の画像を生成してみましょう！</p>
        </div>
      )}

      {/* 画像詳細モーダル */}
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          userId={userId}
          onClose={() => setSelectedImage(null)}
          onDelete={handleDeleteImage}
        />
      )}
    </div>
  );
}

// ユーティリティ関数
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}