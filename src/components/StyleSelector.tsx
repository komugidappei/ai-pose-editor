'use client';

import { useState, useEffect } from 'react';
import { 
  getAvailableStyles,
  getPremiumStyles,
  getFreeStyles,
  getNewStyles,
  getPopularStyles,
  getRecentStyles,
  getThisMonthStyle,
  canUserAccessStyle,
  recordStyleUsage,
  STYLE_CATEGORIES,
  type AIStyle 
} from '@/lib/aiStyles';

interface StyleSelectorProps {
  selectedStyleId?: string;
  onStyleSelect: (styleId: string) => void;
  isPremiumUser?: boolean;
  compact?: boolean; // コンパクト表示モード
}

export default function StyleSelector({ 
  selectedStyleId, 
  onStyleSelect, 
  isPremiumUser = false,
  compact = false 
}: StyleSelectorProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'free' | 'premium' | 'categories'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [styles, setStyles] = useState<AIStyle[]>([]);
  const [filteredStyles, setFilteredStyles] = useState<AIStyle[]>([]);

  useEffect(() => {
    loadStyles();
  }, [activeTab, selectedCategory]);

  useEffect(() => {
    filterStyles();
  }, [styles, searchKeyword]);

  const loadStyles = () => {
    let loadedStyles: AIStyle[] = [];

    switch (activeTab) {
      case 'free':
        loadedStyles = getFreeStyles();
        break;
      case 'premium':
        loadedStyles = getPremiumStyles();
        break;
      case 'categories':
        if (selectedCategory) {
          loadedStyles = getAvailableStyles().filter(style => style.category === selectedCategory);
        } else {
          loadedStyles = getAvailableStyles();
        }
        break;
      default:
        loadedStyles = getAvailableStyles();
    }

    setStyles(loadedStyles);
  };

  const filterStyles = () => {
    if (!searchKeyword) {
      setFilteredStyles(styles);
      return;
    }

    const filtered = styles.filter(style =>
      style.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      style.description.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      style.examples.some(example => 
        example.toLowerCase().includes(searchKeyword.toLowerCase())
      )
    );

    setFilteredStyles(filtered);
  };

  const handleStyleSelect = (styleId: string) => {
    if (!canUserAccessStyle(styleId, isPremiumUser)) {
      alert('このスタイルはプレミアムユーザー限定です。アップグレードしてください。');
      return;
    }

    recordStyleUsage(styleId);
    onStyleSelect(styleId);
  };

  const thisMonthStyle = getThisMonthStyle();
  const newStyles = getNewStyles();
  const popularStyles = getPopularStyles(3);
  const recentStyles = getRecentStyles(3);

  if (compact) {
    return (
      <div className="space-y-4">
        {/* 検索 */}
        <div>
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="スタイルを検索..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* スタイル一覧（コンパクト） */}
        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {filteredStyles.map((style) => (
            <button
              key={style.id}
              onClick={() => handleStyleSelect(style.id)}
              disabled={!canUserAccessStyle(style.id, isPremiumUser)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                selectedStyleId === style.id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : canUserAccessStyle(style.id, isPremiumUser)
                  ? 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                  : 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-lg">{style.thumbnail}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-gray-900 truncate">{style.name}</h4>
                </div>
                {style.isPremium && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">
                    Pro
                  </span>
                )}
                {style.isNew && (
                  <span className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded-full">
                    New
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">{style.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold flex items-center space-x-2">
          <span>🎨</span>
          <span>AI画像スタイル</span>
          {!isPremiumUser && (
            <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
              Free Plan
            </span>
          )}
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          画像生成に適用するスタイルを選択してください
        </p>
      </div>

      <div className="p-6">
        {/* 今月の新スタイル */}
        {thisMonthStyle && isPremiumUser && (
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
            <h3 className="font-semibold text-purple-900 mb-2 flex items-center space-x-2">
              <span>✨</span>
              <span>今月の新スタイル</span>
            </h3>
            <button
              onClick={() => handleStyleSelect(thisMonthStyle.id)}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                selectedStyleId === thisMonthStyle.id
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-purple-200 hover:border-purple-300 bg-white'
              }`}
            >
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-2xl">{thisMonthStyle.thumbnail}</span>
                <div>
                  <h4 className="font-semibold text-gray-900">{thisMonthStyle.name}</h4>
                  <p className="text-sm text-gray-600">{thisMonthStyle.description}</p>
                </div>
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                  NEW
                </span>
              </div>
              <p className="text-sm text-purple-700 italic">{thisMonthStyle.preview}</p>
            </button>
          </div>
        )}

        {/* クイックアクセス */}
        {(popularStyles.length > 0 || recentStyles.length > 0) && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">クイックアクセス</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {popularStyles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center space-x-1">
                    <span>🔥</span>
                    <span>人気スタイル</span>
                  </h4>
                  <div className="space-y-1">
                    {popularStyles.slice(0, 3).map((style) => (
                      <button
                        key={style.id}
                        onClick={() => handleStyleSelect(style.id)}
                        disabled={!canUserAccessStyle(style.id, isPremiumUser)}
                        className={`w-full p-2 rounded text-left text-sm transition-colors ${
                          selectedStyleId === style.id
                            ? 'bg-blue-100 text-blue-900'
                            : canUserAccessStyle(style.id, isPremiumUser)
                            ? 'hover:bg-gray-100 text-gray-700'
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <span className="mr-2">{style.thumbnail}</span>
                        {style.name}
                        {style.isPremium && !isPremiumUser && (
                          <span className="ml-1 text-xs">🔒</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recentStyles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center space-x-1">
                    <span>⏰</span>
                    <span>最近使用</span>
                  </h4>
                  <div className="space-y-1">
                    {recentStyles.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => handleStyleSelect(style.id)}
                        disabled={!canUserAccessStyle(style.id, isPremiumUser)}
                        className={`w-full p-2 rounded text-left text-sm transition-colors ${
                          selectedStyleId === style.id
                            ? 'bg-blue-100 text-blue-900'
                            : canUserAccessStyle(style.id, isPremiumUser)
                            ? 'hover:bg-gray-100 text-gray-700'
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <span className="mr-2">{style.thumbnail}</span>
                        {style.name}
                        {style.isPremium && !isPremiumUser && (
                          <span className="ml-1 text-xs">🔒</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* タブナビゲーション */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              すべて
            </button>
            <button
              onClick={() => setActiveTab('free')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'free'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              無料
            </button>
            <button
              onClick={() => setActiveTab('premium')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-1 ${
                activeTab === 'premium'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>プレミアム</span>
              {!isPremiumUser && <span className="text-xs">🔒</span>}
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'categories'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              カテゴリ
            </button>
          </div>
        </div>

        {/* カテゴリ選択（カテゴリタブが選択されている場合） */}
        {activeTab === 'categories' && (
          <div className="mb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(STYLE_CATEGORIES).map(([key, category]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(selectedCategory === key ? '' : key)}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    selectedCategory === key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{category.icon}</span>
                    <div>
                      <h4 className="font-medium text-sm">{category.name}</h4>
                      <p className="text-xs text-gray-600 line-clamp-1">{category.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 検索 */}
        <div className="mb-4">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="スタイル名や説明で検索..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* スタイル一覧 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredStyles.map((style) => (
            <button
              key={style.id}
              onClick={() => handleStyleSelect(style.id)}
              disabled={!canUserAccessStyle(style.id, isPremiumUser)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedStyleId === style.id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : canUserAccessStyle(style.id, isPremiumUser)
                  ? 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                  : 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start space-x-3 mb-3">
                <span className="text-2xl">{style.thumbnail}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-semibold text-gray-900 truncate">{style.name}</h4>
                    {style.isPremium && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                        Premium
                      </span>
                    )}
                    {style.isNew && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{style.description}</p>
                  <p className="text-xs text-gray-500 italic">{style.preview}</p>
                </div>
              </div>

              {/* サンプルプロンプト */}
              <div className="border-t pt-3">
                <h5 className="text-xs font-medium text-gray-700 mb-1">使用例:</h5>
                <div className="space-y-1">
                  {style.examples.slice(0, 2).map((example, index) => (
                    <p key={index} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                      "{example}"
                    </p>
                  ))}
                </div>
              </div>

              {/* プロンプトタグ */}
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-gray-500">
                  プロンプトタグ: <code className="bg-gray-100 px-1 rounded">{style.promptTag}</code>
                </p>
              </div>

              {/* アクセス不可の場合の表示 */}
              {!canUserAccessStyle(style.id, isPremiumUser) && (
                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <span className="text-sm text-gray-500">プレミアム限定</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      alert('プレミアムプランにアップグレードしてください');
                    }}
                    className="text-xs bg-yellow-500 text-white px-3 py-1 rounded-full hover:bg-yellow-600 transition-colors"
                  >
                    アップグレード
                  </button>
                </div>
              )}
            </button>
          ))}
        </div>

        {filteredStyles.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎨</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchKeyword ? '検索結果がありません' : 'スタイルが見つかりません'}
            </h3>
            <p className="text-gray-600">
              {searchKeyword 
                ? '別のキーワードで検索してみてください' 
                : '条件に合うスタイルがありません'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}