'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { getGuestGallery, removeFromGuestGallery, getGalleryStats, type GeneratedImage } from '@/lib/gallery';
import ShareCardGenerator from '@/components/ShareCardGenerator';

interface ImageModalProps {
  image: GeneratedImage;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onShare: (image: GeneratedImage) => void;
}

function ImageModal({ image, isOpen, onClose, onDelete, onShare }: ImageModalProps) {
  if (!isOpen) return null;
  
  const handleDelete = () => {
    if (confirm('この画像を削除しますか？')) {
      onDelete(image.id!);
      onClose();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">画像詳細</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 画像表示 */}
            <div>
              <img
                src={image.image_base64 || image.image_url}
                alt="Generated image"
                className="w-full rounded-lg shadow-lg"
              />
              
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {image.is_commercial && (
                    <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                      商用利用
                    </span>
                  )}
                  <span className="text-sm text-gray-500">
                    {image.resolution}
                  </span>
                </div>
                
                <div className="flex space-x-2">
                  <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.download = image.is_commercial 
                        ? `commercial-${image.id}-${Date.now()}.png`
                        : `image-${image.id}-${Date.now()}.png`;
                      link.href = image.image_base64 || image.image_url || '';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    ダウンロード
                  </button>
                  <button 
                    onClick={() => onShare(image)}
                    className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors flex items-center space-x-2"
                  >
                    <span>📱</span>
                    <span>共有</span>
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
            
            {/* 詳細情報 */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">プロンプト</h3>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{image.prompt}</p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">生成情報</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">スタイル</span>
                    <span className="font-medium">{image.style}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">背景</span>
                    <span className="font-medium">{image.background}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">解像度</span>
                    <span className="font-medium">{image.resolution}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">処理時間</span>
                    <span className="font-medium">{image.processing_time}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">生成日時</span>
                    <span className="font-medium">
                      {new Date(image.created_at!).toLocaleString('ja-JP')}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">ポーズデータ</h3>
                <details className="bg-gray-50 rounded-lg">
                  <summary className="cursor-pointer p-3 font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
                    JSONデータを表示
                  </summary>
                  <pre className="p-3 text-xs text-gray-600 overflow-auto max-h-40 border-t">
                    {JSON.stringify(image.pose_data, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareImage, setShareImage] = useState<GeneratedImage | null>(null);
  const [stats, setStats] = useState({
    totalImages: 0,
    commercialImages: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0
  });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadGallery();
  }, []);
  
  const loadGallery = async () => {
    setLoading(true);
    try {
      // ゲストユーザーのデータを読み込み
      const galleryData = getGuestGallery();
      setImages(galleryData);
      
      // 統計情報を取得
      const statsData = await getGalleryStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading gallery:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleImageClick = (image: GeneratedImage) => {
    setSelectedImage(image);
    setIsModalOpen(true);
  };
  
  const handleImageDelete = (imageId: string) => {
    const success = removeFromGuestGallery(imageId);
    if (success) {
      setImages(images.filter(img => img.id !== imageId));
      loadGallery(); // 統計を更新
    }
  };

  const handleImageShare = (image: GeneratedImage) => {
    setShareImage(image);
    setIsShareModalOpen(true);
  };
  
  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">ギャラリーを読み込んでいます...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">マイギャラリー</h1>
          <p className="text-gray-600 text-lg">あなたが生成した画像の一覧です</p>
        </div>
        
        {/* 統計情報 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalImages}</div>
            <div className="text-sm text-gray-600">総画像数</div>
          </div>
          <div className="bg-white rounded-lg border shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.commercialImages}</div>
            <div className="text-sm text-gray-600">商用利用</div>
          </div>
          <div className="bg-white rounded-lg border shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{Math.round(stats.totalProcessingTime / 1000)}s</div>
            <div className="text-sm text-gray-600">総処理時間</div>
          </div>
          <div className="bg-white rounded-lg border shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{Math.round(stats.averageProcessingTime / 1000)}s</div>
            <div className="text-sm text-gray-600">平均処理時間</div>
          </div>
        </div>
        
        {/* 画像一覧 */}
        {images.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">まだ画像がありません</h3>
            <p className="text-gray-600 mb-4">ポーズエディターで最初の作品を作成してみましょう！</p>
            <a
              href="/viewer"
              className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              ポーズエディターへ
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {images.map((image) => (
              <div
                key={image.id}
                className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleImageClick(image)}
              >
                <div className="aspect-square bg-gray-100 rounded-t-lg overflow-hidden">
                  <img
                    src={image.image_base64 || image.image_url}
                    alt="Generated image"
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                  />
                </div>
                
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">
                      {new Date(image.created_at!).toLocaleDateString('ja-JP')}
                    </span>
                    {image.is_commercial && (
                      <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                        商用
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                    {image.prompt}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span>{image.style}</span>
                    <span>{image.resolution}</span>
                  </div>
                  
                  {/* クイック共有ボタン */}
                  <div className="flex space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleImageShare(image);
                      }}
                      className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-1 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center space-x-1"
                    >
                      <span>📱</span>
                      <span>共有</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const link = document.createElement('a');
                        link.download = image.is_commercial 
                          ? `commercial-${image.id}-${Date.now()}.png`
                          : `image-${image.id}-${Date.now()}.png`;
                        link.href = image.image_base64 || image.image_url || '';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-xs transition-colors"
                    >
                      💾
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* 画像詳細モーダル */}
        {selectedImage && (
          <ImageModal
            image={selectedImage}
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onDelete={handleImageDelete}
            onShare={handleImageShare}
          />
        )}

        {/* シェアカード生成モーダル */}
        {shareImage && (
          <ShareCardGenerator
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            generatedImage={shareImage.image_base64 || shareImage.image_url || ''}
            prompt={shareImage.prompt}
            poseData={shareImage.pose_data}
            style={shareImage.style}
            background={shareImage.background}
            isCommercial={shareImage.is_commercial}
          />
        )}
      </div>
    </Layout>
  );
}