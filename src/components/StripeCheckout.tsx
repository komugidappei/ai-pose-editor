'use client';

// Stripe Elements決済フォーム
// セキュリティ最優先：クレカ番号の直接取扱い完全禁止

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { PlanName, SUBSCRIPTION_PLANS } from '@/lib/stripe';

// Stripe公開キー（フロントエンド用）
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface StripeCheckoutProps {
  planName: PlanName;
  userId: string;
  userEmail: string;
  onSuccess: (sessionId: string) => void;
  onError: (error: string) => void;
}

interface CheckoutFormProps {
  planName: PlanName;
  userId: string;
  userEmail: string;
  onSuccess: (sessionId: string) => void;
  onError: (error: string) => void;
}

// Stripe Elements スタイル設定
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#424770',
      letterSpacing: '0.025em',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#9e2146',
    },
  },
  hidePostalCode: false, // 郵便番号も収集（不正利用防止）
};

/**
 * 決済フォームコンポーネント
 * 重要：クレカ番号を直接取り扱わない
 */
function CheckoutForm({ 
  planName, 
  userId, 
  userEmail, 
  onSuccess, 
  onError 
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  const plan = SUBSCRIPTION_PLANS[planName];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      setError('Stripe has not loaded yet');
      return;
    }

    if (processingPayment) {
      return; // 重複送信防止
    }

    setLoading(true);
    setProcessingPayment(true);
    setError(null);

    try {
      // 1. Checkout Session作成
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planName,
          userId,
          userEmail,
          successUrl: `${window.location.origin}/dashboard?payment=success`,
          cancelUrl: `${window.location.origin}/pricing?payment=canceled`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { sessionId } = await response.json();

      // 2. Stripe Checkoutにリダイレクト
      // 重要：クレカ番号はStripe側で安全に処理される
      const result = await stripe.redirectToCheckout({
        sessionId: sessionId,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      // 成功時はリダイレクトされるため、この部分は実行されない
      onSuccess(sessionId);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      onError(errorMessage);
      console.error('Payment failed:', err);
    } finally {
      setLoading(false);
      setProcessingPayment(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* プラン詳細 */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-lg mb-2">{plan.name} プラン</h3>
        <p className="text-2xl font-bold text-blue-600 mb-3">
          ¥{plan.price.toLocaleString()}/月
        </p>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• 1日の生成回数: {plan.limits.dailyGenerations === -1 ? '無制限' : `${plan.limits.dailyGenerations}回`}</li>
          <li>• 保存画像数: {plan.limits.totalImages}枚</li>
          <li>• 商用利用: {plan.limits.commercialUse ? '可能' : '不可'}</li>
          <li>• ウォーターマーク: {plan.limits.watermark ? 'あり' : 'なし'}</li>
        </ul>
      </div>

      {/* セキュリティ警告 */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs">🔒</span>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-800">
              安全な決済
            </p>
            <p className="text-xs text-blue-600">
              クレジットカード情報は暗号化され、当サイトでは保存されません
            </p>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* 決済ボタン */}
      <button
        type="submit"
        disabled={!stripe || loading || processingPayment}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
          loading || processingPayment
            ? 'bg-gray-400 cursor-not-allowed text-gray-200'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {loading || processingPayment ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>処理中...</span>
          </div>
        ) : (
          `${plan.name}プランを購入 - ¥${plan.price.toLocaleString()}/月`
        )}
      </button>

      {/* 利用規約 */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• 初回決済完了後、即座にプラン機能が利用可能になります</p>
        <p>• 月額制サブスクリプションです（いつでもキャンセル可能）</p>
        <p>• 決済情報は256bit SSL暗号化により保護されています</p>
        <p>• 購入により <a href="/terms" className="text-blue-600 hover:underline">利用規約</a> に同意したものとみなされます</p>
      </div>
    </form>
  );
}

/**
 * Stripe Checkout コンポーネント
 * Elements Provider でラップ
 */
export default function StripeCheckout({ 
  planName, 
  userId, 
  userEmail, 
  onSuccess, 
  onError 
}: StripeCheckoutProps) {
  const [stripeReady, setStripeReady] = useState(false);

  useEffect(() => {
    if (stripePromise) {
      setStripeReady(true);
    }
  }, []);

  if (!stripeReady) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">決済システムを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm
        planName={planName}
        userId={userId}
        userEmail={userEmail}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}