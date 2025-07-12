'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import StyleSelector from '@/components/StyleSelector';
import { 
  getAvailableStyles,
  getThisMonthStyle,
  getNewStyles,
  getPopularStyles,
  STYLE_CATEGORIES,
  type AIStyle 
} from '@/lib/aiStyles';
import { 
  isPremiumUser, 
  getUserSubscription, 
  upgradeSubscription,
  getPlanComparison,
  getUpgradeMessage 
} from '@/lib/subscription';

export default function AIStylesPage() {
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  
  const userIsPremium = isPremiumUser('guest');
  const subscription = getUserSubscription('guest');
  const thisMonthStyle = getThisMonthStyle();
  const newStyles = getNewStyles();
  const popularStyles = getPopularStyles(6);
  const allStyles = getAvailableStyles();
  const plans = getPlanComparison();

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyleId(styleId);
  };

  const handleUpgrade = async (plan: 'premium' | 'pro') => {
    setIsUpgrading(true);
    try {
      const result = upgradeSubscription('guest', plan);
      if (result.success) {
        alert(`${plan === 'premium' ? 'プレミアム' : 'プロ'}プランにアップグレードしました！`);
        setShowUpgradeModal(false);
        // ページをリロードして新しいプラン状態を反映
        window.location.reload();
      } else {
        alert(result.error || 'アップグレードに失敗しました');
      }
    } catch (error) {
      alert('アップグレードに失敗しました');
    } finally {
      setIsUpgrading(false);
    }
  };

  const premiumStyles = allStyles.filter(style => style.isPremium);
  const freeStyles = allStyles.filter(style => !style.isPremium);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center space-x-3">
            <span>🎨</span>
            <span>AI画像スタイル</span>
          </h1>
          <p className="text-gray-600 text-lg">
            月替わりの豊富なスタイルで、あなただけの特別な画像を生成しましょう
          </p>
        </div>

        {/* 現在のプラン情報 */}
        <div className={`mb-8 p-6 rounded-lg border-2 ${
          userIsPremium 
            ? 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200' 
            : 'bg-gradient-to-r from-gray-50 to-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2 flex items-center space-x-2">
                <span>{userIsPremium ? '✨' : '🆓'}</span>
                <span>現在のプラン: {subscription.plan === 'free' ? '無料プラン' : subscription.plan === 'premium' ? 'プレミアムプラン' : 'プロプラン'}</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">利用可能スタイル:</span>
                  <div className="font-semibold">
                    {userIsPremium ? `${allStyles.length}種類` : `${freeStyles.length}種類`}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">月替わりスタイル:</span>
                  <div className="font-semibold">
                    {userIsPremium ? '利用可能' : '制限あり'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">最大解像度:</span>
                  <div className="font-semibold">
                    {subscription.limits.maxResolution}px
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">商用利用:</span>
                  <div className="font-semibold">
                    {subscription.limits.commercialUse === -1 ? '無制限' : `${subscription.limits.commercialUse}回/日`}
                  </div>
                </div>
              </div>
            </div>
            {!userIsPremium && (
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105"
              >
                アップグレード
              </button>
            )}
          </div>
        </div>

        {/* 今月の新スタイル */}
        {thisMonthStyle && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <span>🌟</span>
              <span>今月の新スタイル</span>
            </h2>
            <div className={`p-6 rounded-lg border-2 ${
              userIsPremium 
                ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 hover:shadow-lg transition-shadow cursor-pointer'
                : 'bg-gray-50 border-gray-200 opacity-75'
            }`}
            onClick={() => userIsPremium && handleStyleSelect(thisMonthStyle.id)}
            >
              <div className="flex items-start space-x-4">
                <span className="text-4xl">{thisMonthStyle.thumbnail}</span>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">{thisMonthStyle.name}</h3>
                    <span className="bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded-full">
                      NEW
                    </span>
                    {!userIsPremium && (
                      <span className="bg-yellow-100 text-yellow-800 text-sm px-3 py-1 rounded-full">
                        Premium限定
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 mb-2">{thisMonthStyle.description}</p>
                  <p className="text-purple-700 italic text-sm">{thisMonthStyle.preview}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {thisMonthStyle.examples.map((example, index) => (
                      <span key={index} className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                        "{example}"
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {!userIsPremium && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-yellow-800 text-sm">
                    {getUpgradeMessage('aiStyles')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 新着スタイル */}
        {newStyles.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <span>🆕</span>
              <span>新着スタイル</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {newStyles.slice(0, 6).map((style) => (
                <div
                  key={style.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    (userIsPremium || !style.isPremium)
                      ? 'hover:shadow-md cursor-pointer border-gray-200 hover:border-gray-300'
                      : 'border-gray-200 opacity-60'
                  }`}
                  onClick={() => (userIsPremium || !style.isPremium) && handleStyleSelect(style.id)}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-2xl">{style.thumbnail}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{style.name}</h3>
                      <div className="flex items-center space-x-1">
                        <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                          New
                        </span>
                        {style.isPremium && (
                          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                            Premium
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">{style.description}</p>
                  {style.isPremium && !userIsPremium && (
                    <p className="text-yellow-600 text-xs">🔒 プレミアム限定</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 人気スタイル */}
        {popularStyles.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <span>🔥</span>
              <span>人気スタイル</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {popularStyles.map((style) => (
                <div
                  key={style.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    (userIsPremium || !style.isPremium)
                      ? 'hover:shadow-md cursor-pointer border-gray-200 hover:border-gray-300'
                      : 'border-gray-200 opacity-60'
                  }`}
                  onClick={() => (userIsPremium || !style.isPremium) && handleStyleSelect(style.id)}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-2xl">{style.thumbnail}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{style.name}</h3>
                      <div className="flex items-center space-x-1">
                        {style.isPremium && (
                          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                            Premium
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">{style.description}</p>
                  {style.isPremium && !userIsPremium && (
                    <p className="text-yellow-600 text-xs">🔒 プレミアム限定</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* スタイル一覧 */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">全スタイル一覧</h2>
          <StyleSelector
            selectedStyleId={selectedStyleId}
            onStyleSelect={handleStyleSelect}
            isPremiumUser={userIsPremium}
            compact={false}
          />
        </div>

        {/* アップグレードモーダル */}
        {showUpgradeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-3xl font-bold text-gray-900">プラン比較</h2>
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`p-6 rounded-lg border-2 transition-all ${
                        plan.id === 'premium'
                          ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                          : plan.id === 'pro'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 bg-gray-50'
                      }`}
                    >
                      <div className="text-center mb-4">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.displayName}</h3>
                        <div className="text-3xl font-bold text-gray-900 mb-1">
                          ¥{plan.price.toLocaleString()}
                          <span className="text-sm font-normal text-gray-600">/月</span>
                        </div>
                        <p className="text-gray-600 text-sm">{plan.description}</p>
                      </div>

                      <div className="space-y-2 mb-6">
                        {plan.features.map((feature, index) => (
                          <div key={index} className="flex items-center text-sm">
                            <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            {feature}
                          </div>
                        ))}
                      </div>

                      {plan.id !== 'free' && (
                        <button
                          onClick={() => handleUpgrade(plan.id as 'premium' | 'pro')}
                          disabled={isUpgrading}
                          className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                            plan.id === 'premium'
                              ? 'bg-purple-500 hover:bg-purple-600 text-white'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                          } disabled:opacity-50`}
                        >
                          {isUpgrading ? '処理中...' : `${plan.displayName}にアップグレード`}
                        </button>
                      )}

                      {plan.id === 'premium' && (
                        <div className="mt-2 text-center">
                          <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                            おすすめ
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">💡 プレミアムプランの特典</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• 毎月新しいAIスタイルが追加されます</li>
                    <li>• 全ての月替わりスタイルが利用可能</li>
                    <li>• 高解像度での画像生成</li>
                    <li>• 商用利用制限の解除</li>
                    <li>• 優先サポート</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}