'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { 
  getPromptsByCategory,
  generateCombinedPrompt,
  savePromptCombination,
  getPromptCombinations,
  deletePromptCombination,
  getPromptById,
  PROMPT_CATEGORIES,
  type PromptCategory,
  type CategorizedPrompt,
  type PromptCombination 
} from '@/lib/prompts';

interface CombinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (combination: {
    name: string;
    description?: string;
    character_prompt_id?: string;
    clothing_prompt_id?: string;
    background_prompt_id?: string;
    lighting_prompt_id?: string;
    combined_prompt: string;
  }) => void;
  selectedPrompts: {
    character?: string;
    clothing?: string;
    background?: string;
    lighting?: string;
  };
  combinedPrompt: string;
}

function CombinationModal({ isOpen, onClose, onSave, selectedPrompts, combinedPrompt }: CombinationModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  
  if (!isOpen) return null;
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      character_prompt_id: selectedPrompts.character,
      clothing_prompt_id: selectedPrompts.clothing,
      background_prompt_id: selectedPrompts.background,
      lighting_prompt_id: selectedPrompts.lighting,
      combined_prompt: combinedPrompt
    });
    onClose();
    setFormData({ name: '', description: '' });
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">組み合わせを保存</h2>
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
                組み合わせ名 *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: エレガントな和風ポートレート"
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
                placeholder="組み合わせの説明を入力..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                最終プロンプト
              </label>
              <div className="bg-gray-50 border rounded-lg p-3 text-sm text-gray-700 max-h-32 overflow-y-auto">
                {combinedPrompt || 'プロンプトを選択してください'}
              </div>
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
              disabled={!combinedPrompt}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PromptBuilderPage() {
  const router = useRouter();
  const [selectedPrompts, setSelectedPrompts] = useState<{
    character?: string;
    clothing?: string;
    background?: string;
    lighting?: string;
  }>({});
  
  const [promptsByCategory, setPromptsByCategory] = useState<{
    character: CategorizedPrompt[];
    clothing: CategorizedPrompt[];
    background: CategorizedPrompt[];
    lighting: CategorizedPrompt[];
  }>({
    character: [],
    clothing: [],
    background: [],
    lighting: []
  });
  
  const [combinations, setCombinations] = useState<PromptCombination[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'builder' | 'combinations'>('builder');
  
  useEffect(() => {
    loadAllPrompts();
    loadCombinations();
  }, []);
  
  const loadAllPrompts = () => {
    setPromptsByCategory({
      character: getPromptsByCategory('character'),
      clothing: getPromptsByCategory('clothing'),
      background: getPromptsByCategory('background'),
      lighting: getPromptsByCategory('lighting')
    });
  };
  
  const loadCombinations = () => {
    setCombinations(getPromptCombinations());
  };
  
  const handlePromptSelect = (category: PromptCategory, promptId: string) => {
    setSelectedPrompts(prev => ({
      ...prev,
      [category]: prev[category] === promptId ? undefined : promptId
    }));
  };
  
  const generateCombined = () => {
    return generateCombinedPrompt(
      selectedPrompts.character,
      selectedPrompts.clothing,
      selectedPrompts.background,
      selectedPrompts.lighting
    );
  };
  
  const handleSaveCombination = (combinationData: {
    name: string;
    description?: string;
    character_prompt_id?: string;
    clothing_prompt_id?: string;
    background_prompt_id?: string;
    lighting_prompt_id?: string;
    combined_prompt: string;
  }) => {
    const saved = savePromptCombination({
      ...combinationData,
      user_id: 'guest'
    });
    setCombinations(prev => [saved, ...prev]);
  };
  
  const handleUseCombination = (combination: PromptCombination) => {
    // ポーズエディターにプロンプトを渡してリダイレクト
    localStorage.setItem('selectedPrompt', combination.combined_prompt || '');
    router.push('/viewer');
  };
  
  const handleDeleteCombination = (combinationId: string) => {
    if (confirm('この組み合わせを削除しますか？')) {
      const success = deletePromptCombination(combinationId);
      if (success) {
        setCombinations(prev => prev.filter(c => c.id !== combinationId));
      }
    }
  };
  
  const handleUseInEditor = () => {
    const combined = generateCombined();
    if (!combined) {
      alert('プロンプトを選択してください');
      return;
    }
    
    localStorage.setItem('selectedPrompt', combined);
    router.push('/viewer');
  };
  
  const combinedPrompt = generateCombined();
  const selectedCount = Object.values(selectedPrompts).filter(Boolean).length;
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">プロンプト組み合わせ</h1>
          <p className="text-gray-600 text-lg">カテゴリ別のプロンプトを組み合わせて理想の画像を生成しましょう</p>
        </div>
        
        {/* タブ */}
        <div className="mb-6">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('builder')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                activeTab === 'builder'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>🎨</span>
              <span>プロンプト作成</span>
            </button>
            <button
              onClick={() => setActiveTab('combinations')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                activeTab === 'combinations'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>📚</span>
              <span>保存済み組み合わせ</span>
              <span className="text-xs opacity-75">({combinations.length})</span>
            </button>
          </div>
        </div>
        
        {activeTab === 'builder' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* プロンプト選択エリア */}
            <div className="lg:col-span-2 space-y-6">
              {Object.entries(PROMPT_CATEGORIES).map(([category, info]) => {
                const categoryPrompts = promptsByCategory[category as PromptCategory];
                const selectedPromptId = selectedPrompts[category as PromptCategory];
                
                return (
                  <div key={category} className="bg-white rounded-lg border shadow-sm">
                    <div className="p-4 border-b bg-gray-50">
                      <h2 className="text-lg font-semibold flex items-center space-x-2">
                        <span>{info.icon}</span>
                        <span>{info.name}</span>
                        {selectedPromptId && (
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            選択中
                          </span>
                        )}
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">{info.description}</p>
                    </div>
                    
                    <div className="p-4">
                      {categoryPrompts.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <div className="text-4xl mb-2">{info.icon}</div>
                          <p>まだ{info.name}がありません</p>
                          <a
                            href="/prompts"
                            className="text-blue-500 hover:text-blue-600 text-sm mt-2 inline-block"
                          >
                            プロンプトを作成 →
                          </a>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {categoryPrompts.map((prompt) => (
                            <button
                              key={prompt.id}
                              onClick={() => handlePromptSelect(category as PromptCategory, prompt.id!)}
                              className={`text-left p-3 rounded-lg border transition-all ${
                                selectedPromptId === prompt.id
                                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="font-medium text-gray-900 text-sm">{prompt.name}</h3>
                                {selectedPromptId === prompt.id && (
                                  <div className="text-blue-500">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 line-clamp-2 mb-2">{prompt.content}</p>
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{prompt.usage_count || 0}回使用</span>
                                {prompt.tags && prompt.tags.length > 0 && (
                                  <span className="bg-gray-100 px-1 rounded">{prompt.tags[0]}</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* プレビューエリア */}
            <div className="space-y-6">
              {/* 選択状況 */}
              <div className="bg-white rounded-lg border shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <span>📋</span>
                  <span>選択状況</span>
                  <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {selectedCount}/4
                  </span>
                </h3>
                
                <div className="space-y-3">
                  {Object.entries(PROMPT_CATEGORIES).map(([category, info]) => {
                    const selectedId = selectedPrompts[category as PromptCategory];
                    const selectedPrompt = selectedId ? getPromptById(selectedId) : null;
                    
                    return (
                      <div key={category} className="flex items-center space-x-3">
                        <span className="text-lg">{info.icon}</span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-700">{info.name}</div>
                          <div className="text-xs text-gray-500">
                            {selectedPrompt ? selectedPrompt.name : '未選択'}
                          </div>
                        </div>
                        {selectedPrompt && (
                          <button
                            onClick={() => handlePromptSelect(category as PromptCategory, selectedId!)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* 結合プロンプト */}
              <div className="bg-white rounded-lg border shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <span>✨</span>
                  <span>結合プロンプト</span>
                </h3>
                
                <div className="bg-gray-50 border rounded-lg p-4 min-h-24 max-h-32 overflow-y-auto">
                  {combinedPrompt ? (
                    <p className="text-sm text-gray-700 leading-relaxed">{combinedPrompt}</p>
                  ) : (
                    <p className="text-sm text-gray-500 italic">プロンプトを選択すると、ここに結合されたプロンプトが表示されます</p>
                  )}
                </div>
                
                <div className="mt-4 space-y-2">
                  <button
                    onClick={handleUseInEditor}
                    disabled={!combinedPrompt}
                    className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span>エディターで使用</span>
                  </button>
                  
                  <button
                    onClick={() => setIsModalOpen(true)}
                    disabled={!combinedPrompt}
                    className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    <span>組み合わせを保存</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 保存済み組み合わせ一覧 */
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">保存済みプロンプト組み合わせ</h2>
              <p className="text-gray-600 text-sm mt-1">作成した組み合わせをすぐに使用できます</p>
            </div>
            
            <div className="p-6">
              {combinations.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📚</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    保存済み組み合わせがありません
                  </h3>
                  <p className="text-gray-600 mb-4">
                    プロンプト作成タブで組み合わせを作成・保存してください
                  </p>
                  <button
                    onClick={() => setActiveTab('builder')}
                    className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    組み合わせを作成
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {combinations.map((combination) => (
                    <div key={combination.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 text-lg">{combination.name}</h3>
                        <span className="text-xs text-gray-500">
                          {combination.usage_count || 0}回使用
                        </span>
                      </div>
                      
                      {combination.description && (
                        <p className="text-sm text-gray-600 mb-4">{combination.description}</p>
                      )}
                      
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">構成要素:</h4>
                        <div className="space-y-1 text-xs">
                          {combination.character_prompt_id && (
                            <div className="flex items-center space-x-2">
                              <span>👤</span>
                              <span>{getPromptById(combination.character_prompt_id)?.name}</span>
                            </div>
                          )}
                          {combination.clothing_prompt_id && (
                            <div className="flex items-center space-x-2">
                              <span>👗</span>
                              <span>{getPromptById(combination.clothing_prompt_id)?.name}</span>
                            </div>
                          )}
                          {combination.background_prompt_id && (
                            <div className="flex items-center space-x-2">
                              <span>🏞️</span>
                              <span>{getPromptById(combination.background_prompt_id)?.name}</span>
                            </div>
                          )}
                          {combination.lighting_prompt_id && (
                            <div className="flex items-center space-x-2">
                              <span>💡</span>
                              <span>{getPromptById(combination.lighting_prompt_id)?.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">最終プロンプト:</h4>
                        <div className="bg-gray-50 p-3 rounded text-xs text-gray-700 max-h-20 overflow-y-auto">
                          {combination.combined_prompt}
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleUseCombination(combination)}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
                        >
                          エディターで使用
                        </button>
                        <button
                          onClick={() => handleDeleteCombination(combination.id!)}
                          className="bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded text-sm transition-colors"
                        >
                          削除
                        </button>
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-500">
                        作成日: {new Date(combination.created_at!).toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* 組み合わせ保存モーダル */}
        <CombinationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveCombination}
          selectedPrompts={selectedPrompts}
          combinedPrompt={combinedPrompt}
        />
      </div>
    </Layout>
  );
}