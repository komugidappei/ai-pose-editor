'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { 
  getPromptsByCategory,
  saveGuestPrompt,
  deleteGuestPrompt,
  incrementPromptUsage,
  getPopularPrompts,
  getPromptStats,
  searchPrompts,
  PROMPT_CATEGORIES,
  type PromptCategory,
  type CategorizedPrompt 
} from '@/lib/prompts';
import { SafePrompt, SafeComment } from '@/components/SafeText';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prompt: Omit<CategorizedPrompt, 'id' | 'created_at' | 'usage_count'>) => void;
  category?: PromptCategory;
}

function PromptModal({ isOpen, onClose, onSave, category }: PromptModalProps) {
  const [formData, setFormData] = useState({
    category: category || 'character' as PromptCategory,
    name: '',
    content: '',
    description: '',
    tags: [] as string[],
    is_public: false
  });
  const [tagInput, setTagInput] = useState('');
  
  useEffect(() => {
    if (category) {
      setFormData(prev => ({ ...prev, category }));
    }
  }, [category]);
  
  if (!isOpen) return null;
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      user_id: 'guest'
    });
    onClose();
    setFormData({
      category: 'character',
      name: '',
      content: '',
      description: '',
      tags: [],
      is_public: false
    });
    setTagInput('');
  };
  
  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };
  
  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };
  
  const categoryInfo = PROMPT_CATEGORIES[formData.category];
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {categoryInfo.icon} プロンプトを作成
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                カテゴリ *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as PromptCategory }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {Object.entries(PROMPT_CATEGORIES).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.icon} {info.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">{categoryInfo.description}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                プロンプト名 *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 美しい女性"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                プロンプト内容 *
              </label>
              <textarea
                required
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                placeholder={categoryInfo.placeholder}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                説明
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 h-16"
                placeholder="プロンプトの説明を入力..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                タグ
              </label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="タグを入力..."
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  追加
                </button>
              </div>
              
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full flex items-center space-x-1"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_public"
                checked={formData.is_public}
                onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="is_public" className="text-sm text-gray-700">
                公開プロンプトとして保存
              </label>
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PromptsPage() {
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory>('character');
  const [prompts, setPrompts] = useState<CategorizedPrompt[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stats, setStats] = useState({
    totalPrompts: 0,
    promptsByCategory: {} as Record<PromptCategory, number>,
    totalCombinations: 0,
    mostUsedPrompt: undefined as CategorizedPrompt | undefined
  });
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    loadPrompts();
    loadStats();
  }, [selectedCategory]);
  
  const loadPrompts = () => {
    setLoading(true);
    try {
      let categoryPrompts = getPromptsByCategory(selectedCategory);
      
      if (searchKeyword) {
        categoryPrompts = searchPrompts(categoryPrompts, searchKeyword);
      }
      
      setPrompts(categoryPrompts);
    } catch (error) {
      console.error('Error loading prompts:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadStats = () => {
    const statsData = getPromptStats();
    setStats(statsData);
  };
  
  useEffect(() => {
    loadPrompts();
  }, [searchKeyword]);
  
  const handleSavePrompt = (promptData: Omit<CategorizedPrompt, 'id' | 'created_at' | 'usage_count'>) => {
    const savedPrompt = saveGuestPrompt(promptData);
    if (promptData.category === selectedCategory) {
      setPrompts(prev => [savedPrompt, ...prev]);
    }
    loadStats();
  };
  
  const handleUsePrompt = (prompt: CategorizedPrompt) => {
    incrementPromptUsage(prompt.id!);
    // プロンプトの使用をポーズエディターに通知（後で実装）
    alert(`「${prompt.name}」を選択しました`);
    loadStats();
  };
  
  const handleDeletePrompt = (promptId: string) => {
    if (confirm('このプロンプトを削除しますか？')) {
      const success = deleteGuestPrompt(promptId);
      if (success) {
        setPrompts(prev => prev.filter(p => p.id !== promptId));
        loadStats();
      }
    }
  };
  
  const popularPrompts = getPopularPrompts(selectedCategory, 3);
  const categoryInfo = PROMPT_CATEGORIES[selectedCategory];
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">プロンプト管理</h1>
          <p className="text-gray-600 text-lg">カテゴリ別にプロンプトを整理・管理します</p>
        </div>
        
        {/* 統計情報 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalPrompts}</div>
            <div className="text-sm text-gray-600">総プロンプト数</div>
          </div>
          <div className="bg-white rounded-lg border shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.promptsByCategory[selectedCategory] || 0}</div>
            <div className="text-sm text-gray-600">{categoryInfo.name}</div>
          </div>
          <div className="bg-white rounded-lg border shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.totalCombinations}</div>
            <div className="text-sm text-gray-600">組み合わせ</div>
          </div>
          <div className="bg-white rounded-lg border shadow-sm p-4 text-center">
            <div className="text-lg font-bold text-orange-600">
              {stats.mostUsedPrompt ? stats.mostUsedPrompt.name.slice(0, 8) + '...' : 'N/A'}
            </div>
            <div className="text-sm text-gray-600">人気プロンプト</div>
          </div>
        </div>
        
        {/* カテゴリタブ */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {Object.entries(PROMPT_CATEGORIES).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key as PromptCategory)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                  selectedCategory === key
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{info.icon}</span>
                <span>{info.name}</span>
                <span className="text-xs opacity-75">({stats.promptsByCategory[key as PromptCategory] || 0})</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* 検索とアクション */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder={`${categoryInfo.name}を検索...`}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>新規作成</span>
          </button>
        </div>
        
        {/* 人気プロンプト */}
        {popularPrompts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <span>🔥</span>
              <span>人気の{categoryInfo.name}</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {popularPrompts.map((prompt) => (
                <div key={prompt.id} className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900"><SafePrompt>{prompt.name}</SafePrompt></h3>
                    <span className="text-sm text-orange-600">{prompt.usage_count}回使用</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2"><SafePrompt>{prompt.content}</SafePrompt></p>
                  <button
                    onClick={() => handleUsePrompt(prompt)}
                    className="text-sm bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 transition-colors"
                  >
                    使用する
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* プロンプト一覧 */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold flex items-center space-x-2">
              <span>{categoryInfo.icon}</span>
              <span>{categoryInfo.name}</span>
              {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
            </h2>
            <p className="text-gray-600 text-sm mt-1">{categoryInfo.description}</p>
          </div>
          
          <div className="p-6">
            {prompts.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">{categoryInfo.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchKeyword ? '検索結果がありません' : `${categoryInfo.name}がまだありません`}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchKeyword 
                    ? '別のキーワードで検索してみてください' 
                    : `最初の${categoryInfo.name}プロンプトを作成してみましょう`
                  }
                </p>
                {!searchKeyword && (
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    プロンプトを作成
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prompts.map((prompt) => (
                  <div key={prompt.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 line-clamp-1"><SafePrompt>{prompt.name}</SafePrompt></h3>
                      <div className="flex items-center space-x-2">
                        {prompt.is_public && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            公開
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {prompt.usage_count || 0}回
                        </span>
                      </div>
                    </div>
                    
                    {prompt.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-1"><SafeComment>{prompt.description}</SafeComment></p>
                    )}
                    
                    <p className="text-sm text-gray-700 mb-3 line-clamp-2 bg-gray-50 p-2 rounded">
                      <SafePrompt>{prompt.content}</SafePrompt>
                    </p>
                    
                    {prompt.tags && prompt.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {prompt.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                          >
                            <SafePrompt>{tag}</SafePrompt>
                          </span>
                        ))}
                        {prompt.tags.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{prompt.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                      <span>{new Date(prompt.created_at!).toLocaleDateString('ja-JP')}</span>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUsePrompt(prompt)}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
                      >
                        使用する
                      </button>
                      <button
                        onClick={() => handleDeletePrompt(prompt.id!)}
                        className="bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded text-sm transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* プロンプト作成モーダル */}
        <PromptModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSavePrompt}
          category={selectedCategory}
        />
      </div>
    </Layout>
  );
}