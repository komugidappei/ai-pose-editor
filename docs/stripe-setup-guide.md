# Stripe決済連携セットアップガイド
クレカ番号の直接取扱い完全禁止・セキュリティ最優先実装

## 🎯 実装内容

### ✅ セキュリティ重視の設計
- **クレカ番号直接取扱い禁止**: Stripe Elementsで安全に処理
- **Webhook署名検証**: 改ざん防止とセキュリティ確保
- **メタデータ署名**: 追加のセキュリティレイヤー
- **レート制限**: 悪用防止とシステム保護
- **監査ログ**: 全決済イベントの完全記録

### ✅ 実装済み機能
1. **Stripe Elements決済フォーム** - 安全なクレカ入力
2. **セキュアWebhook処理** - 決済完了時の自動プラン更新
3. **プラン管理システム** - FREE/PREMIUM/PRO制限管理
4. **サブスクリプション管理** - 月額課金・キャンセル処理
5. **カスタマーポータル** - 請求情報管理
6. **包括的監査ログ** - セキュリティとコンプライアンス

## 📋 セットアップ手順

### 1. Stripeアカウント設定

#### Stripeダッシュボードでの設定
```bash
# 1. Stripeアカウント作成
https://dashboard.stripe.com/register

# 2. APIキー取得
- 公開可能キー (pk_test_...)
- シークレットキー (sk_test_...)

# 3. 価格設定作成
製品 > 新しい製品 > 定期請求
- Premium: ¥980/月 (price_1ABC...PREMIUM)
- Pro: ¥1980/月 (price_1ABC...PRO)
```

#### Webhook設定
```bash
# 1. Webhookエンドポイント作成
https://dashboard.stripe.com/webhooks

# 2. エンドポイントURL設定
https://your-domain.com/api/stripe/webhook

# 3. イベント選択
- checkout.session.completed
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_failed

# 4. Webhookシークレット取得 (whsec_...)
```

### 2. 環境変数設定

```env
# Stripe設定
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51ABC...DEF
STRIPE_SECRET_KEY=sk_test_51ABC...XYZ
STRIPE_WEBHOOK_SECRET=whsec_1ABC...XYZ

# 価格ID
STRIPE_PREMIUM_PRICE_ID=price_1ABC...PREMIUM
STRIPE_PRO_PRICE_ID=price_1ABC...PRO

# セキュリティ設定
JWT_SECRET=your-secure-jwt-secret-256bit
ENCRYPTION_KEY=your-encryption-key-256bit
```

### 3. データベーススキーマ展開

```sql
-- Supabaseダッシュボード > SQL Editor で実行
-- または psql で実行

\i database/stripe-schema.sql
```

### 4. 依存関係インストール

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js stripe
```

### 5. CSP設定更新

```typescript
// next.config.js - Stripe用のCSP設定
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 
    https://js.stripe.com;
  connect-src 'self' 
    https://api.stripe.com;
  frame-src 'self' 
    https://js.stripe.com 
    https://hooks.stripe.com;
`;
```

## 🔧 使用方法

### 1. 決済フォーム実装

```typescript
import StripeCheckout from '@/components/StripeCheckout';

function PricingPage() {
  const handlePaymentSuccess = (sessionId: string) => {
    // 決済成功時の処理
    router.push('/dashboard?payment=success');
  };

  const handlePaymentError = (error: string) => {
    // エラー処理
    alert(`決済エラー: ${error}`);
  };

  return (
    <StripeCheckout
      planName="PREMIUM"
      userId={user.id}
      userEmail={user.email}
      onSuccess={handlePaymentSuccess}
      onError={handlePaymentError}
    />
  );
}
```

### 2. プラン制限チェック

```typescript
import { checkActionAllowed } from '@/lib/userPlan';

async function generateImage(userId: string) {
  // アクション実行前の制限チェック
  const check = await checkActionAllowed(userId, 'generate');
  
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  // 制限内の場合のみ実行
  const result = await performImageGeneration();
  
  // 使用量をカウント
  await incrementUsage(userId, 'image_generation');
  
  return result;
}
```

### 3. サブスクリプション管理

```typescript
import SubscriptionManager from '@/components/SubscriptionManager';

function AccountPage() {
  const [planStatus, setPlanStatus] = useState(null);

  useEffect(() => {
    // プラン状態取得
    fetch(`/api/user/plan-status?userId=${user.id}`)
      .then(res => res.json())
      .then(setPlanStatus);
  }, []);

  return (
    <SubscriptionManager
      userId={user.id}
      userEmail={user.email}
      initialPlanStatus={planStatus}
    />
  );
}
```

## 🛡️ セキュリティ機能

### 1. Webhook署名検証

```typescript
// 自動検証 - 改ざん防止
const event = verifyWebhookSignature(body, signature);
```

### 2. メタデータ署名

```typescript
// 追加セキュリティレイヤー
const isValid = verifyMetadataSignature(userId, planName, signature);
```

### 3. レート制限

```typescript
// API保護
const rateLimitResult = await checkoutRateLimit(request);
```

### 4. 監査ログ

```typescript
// 全イベント記録
await supabase.from('payment_logs').insert({
  user_id: userId,
  event_type: 'checkout_completed',
  amount: session.amount_total,
  stripe_session_id: session.id,
});
```

## 📊 プラン制限

### Free プラン
- 1日10回まで画像生成
- 最大10枚まで保存
- ウォーターマーク付き
- 商用利用不可

### Premium プラン (¥980/月)
- 1日100回まで画像生成
- 最大100枚まで保存
- ウォーターマークなし
- 商用利用可能

### Pro プラン (¥1980/月)
- 無制限画像生成
- 最大1000枚まで保存
- ウォーターマークなし
- 商用利用可能
- API アクセス

## 🧪 テスト

### 1. テスト用カード番号

```bash
# 成功
4242 4242 4242 4242

# 拒否
4000 0000 0000 0002

# 3D Secure
4000 0027 6000 3184
```

### 2. Webhook テスト

```bash
# Stripe CLI でローカルテスト
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
```

### 3. 決済フローテスト

```bash
# 1. 決済フォーム表示確認
# 2. テストカードで決済実行
# 3. Webhook受信確認
# 4. プラン更新確認
# 5. 制限解除確認
```

## 🔍 監視・運用

### 1. 決済状況モニタリング

```sql
-- 今日の決済状況
SELECT 
  event_type,
  plan_name,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM payment_logs 
WHERE created_at >= CURRENT_DATE
GROUP BY event_type, plan_name;
```

### 2. プラン利用状況

```sql
-- プラン別ユーザー数
SELECT 
  plan_name,
  status,
  COUNT(*) as user_count
FROM user_plans 
GROUP BY plan_name, status;
```

### 3. エラー監視

```sql
-- 決済エラー確認
SELECT * FROM payment_logs 
WHERE event_type LIKE '%failed%' 
ORDER BY created_at DESC 
LIMIT 10;
```

## 🚀 本番環境デプロイ

### 1. 本番Stripe設定

```bash
# 1. 本番APIキーに変更
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# 2. 本番Webhook設定
https://your-production-domain.com/api/stripe/webhook

# 3. 本番価格ID設定
STRIPE_PREMIUM_PRICE_ID=price_live_...
STRIPE_PRO_PRICE_ID=price_live_...
```

### 2. セキュリティ確認

```bash
# SSL証明書確認
curl -I https://your-domain.com

# Webhook署名確認
stripe webhook endpoint retrieve we_...

# CSP設定確認
curl -I https://your-domain.com | grep Content-Security-Policy
```

### 3. 運用監視設定

```bash
# エラー監視
- Sentry/CloudWatch設定
- 決済失敗アラート
- Webhook失敗通知

# パフォーマンス監視
- 決済完了時間
- API レスポンス時間
- データベース負荷
```

## ⚠️ セキュリティ注意事項

### 🔒 絶対に守るべきルール

1. **クレカ番号を絶対に直接取り扱わない**
   - Stripe Elements以外でカード情報を処理禁止
   - サーバー側でカード番号の保存・ログ出力禁止

2. **Webhook署名検証を必ず実行**
   - 署名なしリクエストは即座に拒否
   - 改ざん検出時は詳細ログ記録

3. **APIキーの厳格管理**
   - 環境変数での管理必須
   - Git履歴にキー情報を残さない
   - 定期的なキーローテーション

4. **レート制限の徹底**
   - 決済API への過度なリクエスト防止
   - DDoS攻撃対策

5. **監査ログの完全記録**
   - 全決済イベントの記録
   - 不正利用の早期発見

この実装により、**PCI DSS準拠**レベルのセキュリティを確保し、安全で信頼性の高い決済システムが完成しました！