# API Rate Limiting Implementation

## 概要

AI Pose Editorの全APIエンドポイントにレート制限を実装しました。IPアドレスベースで1分あたりの最大リクエスト数を制限し、超過時は429 Too Many Requestsエラーを返します。

## 実装されたレート制限

### 1. エンドポイント別制限

| エンドポイント | 制限 | 理由 |
|---|---|---|
| `/api/generate` | 5回/分 | 画像生成は重い処理のため |
| `/api/generate-secure` | 5回/分 | セキュア画像生成API |
| `/api/pose` | 3回/分 | アップロード処理のため |

### 2. グローバル制限（middleware.ts）

- **全API**: 20回/分
- **すべてのエンドポイント**に適用される基本制限

## レスポンスヘッダー

レート制限情報は以下のヘッダーで提供されます：

```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1625097600000
Retry-After: 45
```

- `X-RateLimit-Limit`: 制限値
- `X-RateLimit-Remaining`: 残り回数
- `X-RateLimit-Reset`: リセット時刻（Unix timestamp）
- `Retry-After`: 再試行までの秒数（429レスポンス時のみ）

## 429エラーレスポンス

制限を超えた場合のレスポンス例：

```json
{
  "error": "画像生成の回数制限に達しました。1分後に再試行してください。",
  "retryAfter": 45,
  "limit": 5,
  "remaining": 0,
  "resetTime": "2023-07-01T12:30:00.000Z"
}
```

## 使用技術

### 1. カスタムレート制限ライブラリ (`/src/lib/rateLimit.ts`)

- **メモリベース**: 開発・小規模環境用
- **Redis対応**: 本番環境では環境変数で切り替え可能
- **自動クリーンアップ**: 期限切れエントリを定期削除

### 2. プリセット設定

```typescript
export const rateLimitPresets = {
  strict: { windowMs: 60000, max: 5 },      // 厳しい制限
  standard: { windowMs: 60000, max: 10 },   // 標準制限
  imageGeneration: { windowMs: 60000, max: 5 }, // 画像生成用
  upload: { windowMs: 60000, max: 3 }       // アップロード用
};
```

## IP取得方法

プロキシ環境を考慮した安全なIP取得：

```typescript
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return realIp || 'unknown';
}
```

## 設定のカスタマイズ

### 環境変数

`.env.local` で制限値を調整可能：

```env
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=5
RATE_LIMIT_IMAGE_GENERATION=5
RATE_LIMIT_UPLOAD=3
```

### プログラマチック設定

```typescript
const customLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1分
  max: 10,                 // 10回まで
  message: 'カスタムメッセージ',
  keyGenerator: (req) => getCustomKey(req) // カスタムキー生成
});
```

## セキュリティ機能

### 1. 自動クリーンアップ

- 5分間隔で期限切れエントリを削除
- メモリリークを防止

### 2. エラー処理

- レート制限ライブラリのエラー時は制限をスキップ
- システムの可用性を優先

### 3. プロキシ対応

- `X-Forwarded-For`、`X-Real-IP`ヘッダーに対応
- ロードバランサー環境での正確なIP取得

## 本番環境での考慮事項

### 1. Redis使用

```typescript
// 本番環境ではRedisを使用
if (process.env.REDIS_URL) {
  const redisStore = new RedisStore({
    url: process.env.REDIS_URL
  });
}
```

### 2. 分散環境

- 複数サーバー間でレート制限を共有
- Redis Clusterを使用

### 3. モニタリング

- レート制限違反のログ出力
- 監視システムとの連携

## トラブルシューティング

### よくある問題

1. **制限が効かない**
   - IP取得が正しいか確認
   - プロキシヘッダーの設定を確認

2. **制限が厳しすぎる**
   - 環境変数で制限値を調整
   - プリセットを変更

3. **メモリ使用量が増加**
   - クリーンアップが動作しているか確認
   - Redisへの移行を検討

### デバッグ方法

```typescript
// レート制限状態の確認
import { getRateLimitStats } from '@/lib/rateLimit';

console.log(getRateLimitStats()); // { totalKeys: 150, activeKeys: 45 }
```

## フロントエンドでの処理

### エラーハンドリング

```typescript
try {
  const response = await fetch('/api/generate', { method: 'POST', /* ... */ });
  
  if (response.status === 429) {
    const error = await response.json();
    const retryAfter = response.headers.get('Retry-After');
    
    // ユーザーに適切なメッセージを表示
    showRateLimitMessage(error.message, retryAfter);
    return;
  }
  
  // 通常の処理
} catch (error) {
  // エラーハンドリング
}
```

### 制限情報の表示

```typescript
// レスポンスヘッダーから制限情報を取得
const remaining = response.headers.get('X-RateLimit-Remaining');
const resetTime = response.headers.get('X-RateLimit-Reset');

if (remaining && parseInt(remaining) < 2) {
  showWarning('残り回数が少なくなっています');
}
```

## まとめ

この実装により、AI Pose EditorのAPIは以下の保護を受けます：

- ✅ **DDoS攻撃の軽減**: IP別アクセス制限
- ✅ **リソース保護**: 重い処理の頻度制限
- ✅ **公平な利用**: 全ユーザーへの公平なアクセス
- ✅ **スケーラビリティ**: Redis対応で分散環境に対応
- ✅ **ユーザビリティ**: 適切なエラーメッセージとヘッダー情報