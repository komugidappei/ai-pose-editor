'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { 
  getGuestTemplates, 
  saveGuestTemplate, 
  deleteGuestTemplate, 
  incrementGuestTemplateUsage,
  getTemplateStats,
  filterTemplatesByTag,
  searchTemplates,
  type PoseTemplate 
} from '@/lib/templates';
import { useRouter } from 'next/navigation';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: Omit<PoseTemplate, 'id' | 'created_at' | 'usage_count'>) => void;
  initialData?: {
    prompt: string;
    poseData: any;
  };
}

function TemplateModal({ isOpen, onClose, onSave, initialData }: TemplateModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt: initialData?.prompt || '',
    pose_data: initialData?.poseData || {},
    style: 'リアル',
    background: 'スタジオ',
    tags: [] as string[],
    is_public: false
  });
  const [tagInput, setTagInput] = useState('');
  
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        prompt: initialData.prompt,
        pose_data: initialData.poseData
      }));
    }
  }, [initialData]);
  
  if (!isOpen) return null;
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      user_id: 'guest'
    });
    onClose();
    // フォームをリセット
    setFormData({
      name: '',
      description: '',
      prompt: '',
      pose_data: {},
      style: 'リアル',
      background: 'スタジオ',
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
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">テンプレートを保存</h2>
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
                テンプレート名 *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: ダンシングポーズ"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                説明
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 h-20"
                placeholder="テンプレートの説明を入力..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                プロンプト *
              </label>
              <textarea
                required
                value={formData.prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                placeholder="画像生成用のプロンプトを入力..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  スタイル
                </label>
                <select
                  value={formData.style}
                  onChange={(e) => setFormData(prev => ({ ...prev, style: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="リアル">リアル</option>
                  <option value="アニメ">アニメ</option>
                  <option value="イラスト">イラスト</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  背景
                </label>
                <select
                  value={formData.background}
                  onChange={(e) => setFormData(prev => ({ ...prev, background: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="透明">透明</option>
                  <option value="白">白</option>
                  <option value="スタジオ">スタジオ</option>
                  <option value="自然">自然</option>
                </select>
              </div>
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
                公開テンプレートとして保存
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

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<PoseTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<PoseTemplate[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [stats, setStats] = useState({
    totalTemplates: 0,
    publicTemplates: 0,
    totalUsage: 0,
    mostUsedTemplate: undefined as PoseTemplate | undefined
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    loadTemplates();
  }, []);
  
  useEffect(() => {
    applyFilters();
  }, [templates, searchKeyword, selectedTag]);
  
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const templatesData = getGuestTemplates();
      setTemplates(templatesData);
      
      const statsData = await getTemplateStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const applyFilters = () => {
    let filtered = templates;
    
    if (searchKeyword) {
      filtered = searchTemplates(filtered, searchKeyword);
    }
    
    if (selectedTag) {
      filtered = filterTemplatesByTag(filtered, selectedTag);
    }
    
    setFilteredTemplates(filtered);
  };
  
  const handleSaveTemplate = (templateData: Omit<PoseTemplate, 'id' | 'created_at' | 'usage_count'>) => {
    const savedTemplate = saveGuestTemplate(templateData);
    setTemplates(prev => [savedTemplate, ...prev]);
    loadTemplates(); // 統計を更新
  };
  
  const handleUseTemplate = (template: PoseTemplate) => {
    // 使用回数をインクリメント
    incrementGuestTemplateUsage(template.id!);
    
    // ポーズエディターにデータを渡してリダイレクト
    const templateData = {
      prompt: template.prompt,
      poseData: template.pose_data,
      style: template.style,
      background: template.background
    };
    
    // URLパラメータでデータを渡す（実際はグローバルステートで管理することを推奨）
    localStorage.setItem('selectedTemplate', JSON.stringify(templateData));
    router.push('/viewer');
  };
  
  const handleDeleteTemplate = (templateId: string) => {
    if (confirm('このテンプレートを削除しますか？')) {
      const success = deleteGuestTemplate(templateId);
      if (success) {
        setTemplates(prev => prev.filter(t => t.id !== templateId));
        loadTemplates(); // 統計を更新
      }
    }
  };
  
  const getAllTags = (): string[] => {
    const allTags = templates.flatMap(template => template.tags || []);
    return Array.from(new Set(allTags)).sort();
  };
  
  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">テンプレートを読み込んでいます...</p>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">ポーズテンプレート</h1>
              <p className="text-gray-600 text-lg">保存されたポーズとプロンプトのテンプレート集</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              新しいテンプレート
            </button>
          </div>
        </div>
        
        {/* 統計情報 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalTemplates}</div>
            <div className="text-sm text-gray-600">総テンプレート数</div>
          </div>
          <div className="bg-white rounded-lg border shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.publicTemplates}</div>
            <div className="text-sm text-gray-600">公開テンプレート</div>
          </div>
          <div className="bg-white rounded-lg border shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.totalUsage}</div>
            <div className="text-sm text-gray-600">総使用回数</div>
          </div>
          <div className="bg-white rounded-lg border shadow-sm p-4 text-center">
            <div className="text-lg font-bold text-orange-600">
              {stats.mostUsedTemplate ? stats.mostUsedTemplate.name.slice(0, 8) + '...' : 'N/A'}
            </div>
            <div className="text-sm text-gray-600">人気テンプレート</div>
          </div>
        </div>
        
        {/* 検索とフィルター */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="テンプレートを検索..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">すべてのタグ</option>
            {getAllTags().map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
        
        {/* テンプレート一覧 */}
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchKeyword || selectedTag ? '検索結果がありません' : 'まだテンプレートがありません'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchKeyword || selectedTag 
                ? '別のキーワードで検索してみてください'
                : '最初のテンプレートを作成してみましょう！'
              }
            </p>
            {!searchKeyword && !selectedTag && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                テンプレートを作成
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                      {template.name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      {template.is_public && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                          公開
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {template.usage_count || 0}回使用
                      </span>
                    </div>
                  </div>
                  
                  {template.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {template.description}
                    </p>
                  )}
                  
                  <p className="text-sm text-gray-700 mb-4 line-clamp-3">
                    {template.prompt}
                  </p>
                  
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {template.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                      {template.tags.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{template.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <span>{template.style} × {template.background}</span>
                    <span>
                      {new Date(template.created_at!).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleUseTemplate(template)}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                    >
                      使用する
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id!)}
                      className="bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-lg text-sm transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* テンプレート保存モーダル */}
        <TemplateModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveTemplate}
        />
      </div>
    </Layout>
  );
}