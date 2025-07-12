# Supabase Auth設定ガイド
セッション有効期限短縮とOAuth設定

## 🎯 実装内容

### 1. セッション有効期限を1時間に短縮
- **JWT Expiry**: 3600秒（1時間）
- **自動リフレッシュ**: 期限15分前に自動更新
- **セッション監視**: リアルタイムでセッション状態をチェック

### 2. OAuth ログイン対応
- **Google OAuth**: セキュアなGoogleアカウントログイン
- **GitHub OAuth**: 開発者向けGitHubログイン
- **パスワードレス**: パスワード管理の不安を解消

## 📋 Supabaseダッシュボード設定手順

### Step 1: JWT設定

Supabaseダッシュボード → **Settings** → **Auth** で以下を設定：

```
JWT Expiry: 3600 (1時間)
Refresh Token Rotation: ✅ Enabled
Refresh Token Expiry: 86400 (24時間)
```

### Step 2: Google OAuth設定

1. **Google Cloud Console**でOAuth設定：
   ```
   プロジェクト作成 → APIs & Services → Credentials
   OAuth 2.0 Client ID を作成
   ```

2. **承認済みリダイレクトURI**に追加：
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```

3. **Supabaseダッシュボード** → **Authentication** → **Providers** → **Google**:
   ```
   ✅ Enable Google provider
   Client ID: your-google-client-id
   Client Secret: your-google-client-secret
   Scopes: openid email profile
   ```

### Step 3: GitHub OAuth設定

1. **GitHub**でOAuth App作成：
   ```
   Settings → Developer settings → OAuth Apps → New OAuth App
   ```

2. **Authorization callback URL**:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```

3. **Supabaseダッシュボード** → **Authentication** → **Providers** → **GitHub**:
   ```
   ✅ Enable GitHub provider
   Client ID: your-github-client-id
   Client Secret: your-github-client-secret
   Scopes: user:email
   ```

### Step 4: リダイレクトURL設定

**Settings** → **Auth** → **URL Configuration**:

```
Site URL: https://your-domain.com

Additional Redirect URLs:
http://localhost:3000/auth/callback
https://your-domain.com/auth/callback
```

## 🔧 環境変数設定

`.env.local` ファイルに追加：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# OAuth (オプション - ダッシュボードで設定済みの場合不要)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# セッション設定
SESSION_TIMEOUT_HOURS=1
AUTO_REFRESH_ENABLED=true
SESSION_WARNING_MINUTES=15
```

## 🚀 使用方法

### 基本的な認証コンポーネント

```tsx
import AuthButton from '@/components/AuthButton';

function App() {
  return (
    <AuthButton 
      onAuthChange={(user) => console.log('User:', user)}
      showEmailLogin={false} // OAuth のみの場合
    />
  );
}
```

### 認証状態の監視

```tsx
import { useEffect, useState } from 'react';
import { getCurrentUser, onAuthStateChange } from '@/lib/supabaseAuth';

function useAuth() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // 初期ユーザー取得
    getCurrentUser().then(({ user }) => setUser(user));
    
    // 認証状態監視
    const { data: { subscription } } = onAuthStateChange((user) => {
      setUser(user);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user };
}
```

### セッション管理

```tsx
import { SessionManager } from '@/lib/supabaseAuth';

function MyApp() {
  useEffect(() => {
    const sessionManager = new SessionManager();
    
    sessionManager.start(
      // セッション期限切れ時
      () => {
        alert('セッションが期限切れになりました');
        // ログアウト処理
      },
      // 期限警告時（15分前）
      (minutesLeft) => {
        console.log(`セッション期限まで${minutesLeft}分です`);
      }
    );

    return () => sessionManager.stop();
  }, []);
}
```

## 🔐 セキュリティ機能

### 1. セッション監視
- **自動期限チェック**: 1分間隔でセッション状態確認
- **事前警告**: 期限15分前にユーザーに通知
- **自動リフレッシュ**: シームレスなセッション延長

### 2. プロバイダー別管理
```typescript
const { provider, isOAuth } = getProviderInfo(user);

if (isOAuth) {
  // OAuth ユーザーはパスワード変更不要
  console.log(`${provider} でログイン済み`);
}
```

### 3. セキュアなリダイレクト
```typescript
// 認証後の安全なリダイレクト
/auth/callback → メインページ
/auth/error → エラーページ（詳細なエラー情報付き）
```

## 📊 ユーザー情報の構造

```typescript
interface AuthUser {
  id: string;
  email?: string;
  name?: string;           // full_name または name
  avatar?: string;         // avatar_url または picture
  provider?: string;       // 'google' | 'github' | 'email'
  emailVerified?: boolean;
  lastSignIn?: string;
}
```

## 🗄️ データベース設定

SQLファイル実行：
```sql
-- /supabase/auth-config.sql を実行
-- ユーザープロフィール拡張
-- RLSポリシー設定
-- 自動トリガー設定
```

## 🎨 UI コンポーネント

### ログインモーダル
- **OAuth ボタン**: Google, GitHub
- **メールログイン**: オプション（パスワード必要）
- **エラーハンドリング**: 分かりやすいエラーメッセージ

### セッション警告
- **期限通知**: 残り時間表示
- **延長オプション**: ワンクリックで延長
- **自動ログアウト**: 選択可能

## 🔧 トラブルシューティング

### よくある問題

1. **OAuth リダイレクトエラー**
   ```
   解決: Supabaseとプロバイダー両方のリダイレクトURL確認
   ```

2. **セッション期限が効かない**
   ```
   解決: ダッシュボードのJWT Expiry設定確認
   ```

3. **Google OAuth スコープエラー**
   ```
   解決: Google Cloud Console でスコープ設定確認
   ```

### デバッグ方法

```typescript
// セッション情報確認
import { checkSessionValidity } from '@/lib/supabaseAuth';

const { isValid, shouldRefresh } = await checkSessionValidity();
console.log('Session valid:', isValid, 'Should refresh:', shouldRefresh);
```

## 📈 本番環境での考慮事項

### 1. 環境別URL設定
```
Development: http://localhost:3000
Staging: https://staging.your-domain.com
Production: https://your-domain.com
```

### 2. セキュリティ強化
- **HTTPS必須**: 本番環境では必ずHTTPS使用
- **CORS設定**: 適切なオリジン制限
- **Rate Limiting**: 認証APIのレート制限

### 3. 監視とログ
```sql
-- 認証ログの監視
SELECT * FROM public.auth_audit_log 
WHERE created_at > NOW() - INTERVAL '24 hours';
```

## ✅ 設定確認チェックリスト

- [ ] Supabase JWT Expiry: 3600秒
- [ ] Google OAuth設定完了
- [ ] GitHub OAuth設定完了
- [ ] リダイレクトURL設定
- [ ] 環境変数設定
- [ ] データベーススキーマ実行
- [ ] 認証フロー動作確認
- [ ] セッション期限確認
- [ ] エラーハンドリング確認

この設定により、セキュアで使いやすい認証システムが完成します！