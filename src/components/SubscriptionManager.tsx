'use client';

// サブスクリプション管理コンポーネント
// 月額課金、キャンセル処理、プラン変更

import React, { useState, useEffect } from 'react';
import { UserPlanStatus, getPlanComparison } from '@/lib/userPlan';
import { PlanName } from '@/lib/stripe';
import StripeCheckout from './StripeCheckout';

interface SubscriptionManagerProps {
  userId: string;
  userEmail: string;
  initialPlanStatus: UserPlanStatus;
}

export default function SubscriptionManager({
  userId,
  userEmail,
  initialPlanStatus,
}: SubscriptionManagerProps) {
  const [planStatus, setPlanStatus] = useState(initialPlanStatus);
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanName | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const planComparison = getPlanComparison();
  const currentPlan = planStatus.plan.plan_name;

  /**
   * プラン状態更新
   */
  const refreshPlanStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user/plan-status?userId=${userId}`);
      if (response.ok) {
        const newStatus = await response.json();
        setPlanStatus(newStatus);
      }
    } catch (error) {
      console.error('Failed to refresh plan status:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * サブスクリプションキャンセル
   */
  const handleCancelSubscription = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          cancelAtPeriodEnd: true,
        }),
      });

      if (response.ok) {
        await refreshPlanStatus();
        setShowCancelConfirm(false);
        alert('サブスクリプションをキャンセルしました。現在の期間終了まで利用可能です。');
      } else {
        const error = await response.json();
        alert(`キャンセルに失敗しました: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      alert('キャンセル処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * カスタマーポータルを開く
   */
  const openCustomerPortal = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          returnUrl: window.location.href,
        }),
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        const error = await response.json();
        alert(`ポータルを開けませんでした: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to open customer portal:', error);
      alert('ポータルを開く際にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 決済成功時の処理
   */
  const handlePaymentSuccess = async (sessionId: string) => {
    await refreshPlanStatus();
    setShowUpgrade(false);
    setSelectedPlan(null);
    alert('決済が完了しました！プランが更新されました。');
  };

  /**
   * 決済エラー時の処理
   */
  const handlePaymentError = (error: string) => {
    alert(`決済エラー: ${error}`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* 現在のプラン状態 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">現在のプラン</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* プラン情報 */}
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                currentPlan === 'FREE' ? 'bg-gray-100 text-gray-800' :
                currentPlan === 'PREMIUM' ? 'bg-blue-100 text-blue-800' :
                'bg-purple-100 text-purple-800'
              }`}>
                {planComparison[currentPlan].name}
              </div>
              <div className={`px-2 py-1 rounded text-xs ${
                planStatus.plan.status === 'active' ? 'bg-green-100 text-green-800' :
                planStatus.plan.status === 'canceled' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {planStatus.plan.status === 'active' ? 'アクティブ' :
                 planStatus.plan.status === 'canceled' ? 'キャンセル済み' : '保留中'}
              </div>
            </div>
            
            <p className="text-3xl font-bold text-gray-900 mb-2">
              ¥{planComparison[currentPlan].price.toLocaleString()}
              {currentPlan !== 'FREE' && <span className="text-lg text-gray-500">/月</span>}
            </p>

            {planStatus.daysUntilExpiry !== null && (
              <p className="text-sm text-gray-600 mb-4">
                残り{planStatus.daysUntilExpiry}日で期限切れ
              </p>
            )}
          </div>

          {/* 使用状況 */}
          <div>
            <h4 className="font-semibold mb-3">今日の使用状況</h4>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-sm">
                  <span>画像生成</span>
                  <span>
                    {planStatus.usage.image_generation_count} / {
                      planStatus.limits.dailyGenerations === -1 ? '無制限' : planStatus.limits.dailyGenerations
                    }
                  </span>
                </div>
                {planStatus.limits.dailyGenerations !== -1 && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, (planStatus.usage.image_generation_count / planStatus.limits.dailyGenerations) * 100)}%`
                      }}
                    ></div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between text-sm">
                  <span>保存画像</span>
                  <span>{planStatus.usage.total_images} / {planStatus.limits.totalImages}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${Math.min(100, (planStatus.usage.total_images / planStatus.limits.totalImages) * 100)}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex flex-wrap gap-3 mt-6">
          {currentPlan === 'FREE' ? (
            <button
              onClick={() => setShowUpgrade(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              プランをアップグレード
            </button>
          ) : (
            <>
              {planStatus.plan.status === 'active' && (
                <>
                  <button
                    onClick={openCustomerPortal}
                    disabled={loading}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? '処理中...' : '請求情報を管理'}
                  </button>
                  
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={loading}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    サブスクリプションをキャンセル
                  </button>
                </>
              )}
              
              {currentPlan !== 'PRO' && (
                <button
                  onClick={() => setShowUpgrade(true)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  さらにアップグレード
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* プラン比較 */}
      {showUpgrade && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-6">プランを選択</h3>
          
          <div className="grid md:grid-cols-3 gap-6">
            {Object.entries(planComparison).map(([planName, plan]) => {
              const isCurrentPlan = planName === currentPlan;
              const isDowngrade = planName === 'FREE' && currentPlan !== 'FREE';
              
              if (isDowngrade) return null; // ダウングレードは表示しない
              
              return (
                <div 
                  key={planName}
                  className={`border rounded-lg p-6 ${
                    plan.recommended ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                  } ${isCurrentPlan ? 'opacity-50' : ''}`}
                >
                  {plan.recommended && (
                    <div className="bg-blue-500 text-white text-sm font-medium px-3 py-1 rounded-full inline-block mb-4">
                      おすすめ
                    </div>
                  )}
                  
                  <h4 className="text-lg font-semibold mb-2">{plan.name}</h4>
                  <p className="text-3xl font-bold mb-4">
                    ¥{plan.price.toLocaleString()}
                    {planName !== 'FREE' && <span className="text-lg text-gray-500">/月</span>}
                  </p>
                  
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm">
                        <span className="text-green-500 mr-2">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  {isCurrentPlan ? (
                    <button 
                      disabled 
                      className="w-full py-2 px-4 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                    >
                      現在のプラン
                    </button>
                  ) : planName === 'FREE' ? (
                    <button 
                      disabled 
                      className="w-full py-2 px-4 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                    >
                      無料プラン
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedPlan(planName as PlanName)}
                      className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      このプランを選択
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setShowUpgrade(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Stripe Checkout */}
      {selectedPlan && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">決済情報</h3>
            <button
              onClick={() => setSelectedPlan(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <StripeCheckout
            planName={selectedPlan}
            userId={userId}
            userEmail={userEmail}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        </div>
      )}

      {/* キャンセル確認モーダル */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">サブスクリプションをキャンセルしますか？</h3>
            <p className="text-gray-600 mb-6">
              キャンセル後も現在の期間終了まで機能をご利用いただけます。期間終了後、自動的にFreeプランに変更されます。
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={handleCancelSubscription}
                disabled={loading}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading ? '処理中...' : 'キャンセル実行'}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={loading}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}