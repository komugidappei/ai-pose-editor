# セキュリティ実装ガイド
HTML エスケープ、HTTPS強制、CSP設定

## 🎯 実装内容

### 1. 全テキスト入力のHTMLエスケープ
- **包括的サニタイズ**: すべてのユーザー入力を自動エスケープ
- **コンテキスト別処理**: プロンプト、名前、コメントなど用途別の最適化
- **XSS防止**: 悪意のあるスクリプト注入を完全ブロック

### 2. HTTPS強制（本番環境）
- **自動リダイレクト**: HTTP → HTTPS 301リダイレクト
- **HSTS設定**: ブラウザレベルでHTTPS強制
- **Vercel対応**: Vercelの場合は自動HTTPS適用

### 3. CSP（Content Security Policy）
- **外部スクリプト制限**: 許可されたドメインのみ読み込み可能
- **インライン制限**: 必要最小限のインライン実行のみ許可
- **段階的強化**: 開発→本番で段階的にセキュリティ強化

## 📋 実装されたセキュリティ機能

### **1. HTML エスケープ処理** (`/src/lib/htmlEscape.ts`)

#### 基本エスケープ機能
```typescript
// 基本的なHTMLエスケープ
escapeHtml('<script>alert("XSS")</script>') 
// → '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'

// プロンプト専用サニタイズ
sanitizePrompt('Beautiful <script>alert("XSS")</script> sunset')
// → 'Beautiful  sunset' (HTMLタグ除去 + エスケープ)
```

#### コンテキスト別サニタイズ
```typescript
// 一括サニタイズ（自動判別）
const userInput = {
  prompt: 'Generate a <script>alert("XSS")</script> image',
  name: 'Template<script>hack</script>Name',
  comment: 'Great work! <img src=x onerror=alert("XSS")>',
  tags: ['art', '<script>evil</script>']
};

const sanitized = sanitizeAllTextInputs(userInput);
// すべてのフィールドが適切にサニタイズされる
```

#### 対応する攻撃パターン
- **XSS注入**: `<script>`, `javascript:`, `onerror=` など
- **HTMLインジェクション**: `<iframe>`, `<object>`, `<embed>` など
- **CSS注入**: `expression()`, `url()` など
- **プロトコル注入**: `javascript:`, `data:`, `vbscript:` など

### **2. HTTPS強制** (`next.config.js`, `middleware.ts`)

#### Next.js設定
```javascript
// next.config.js - 本番環境でHTTPS強制
async redirects() {
  if (isProduction) {
    return [{
      source: '/:path*',
      has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
      destination: 'https://your-domain.com/:path*',
      permanent: true,
    }];
  }
  return [];
}
```

#### ミドルウェア設定
```typescript
// middleware.ts - リアルタイムHTTPS強制
export async function middleware(request: NextRequest) {
  const httpsRedirect = enforceHTTPS(request);
  if (httpsRedirect) {
    return httpsRedirect; // 301リダイレクト
  }
  // ...
}
```

#### HSTS設定
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### **3. CSP設定** (`/src/lib/securityHeaders.ts`)

#### 厳格なCSPポリシー
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 
    https://www.google.com 
    https://www.gstatic.com 
    https://www.recaptcha.net;
  style-src 'self' 'unsafe-inline' 
    https://fonts.googleapis.com;
  img-src 'self' data: blob: 
    https://*.supabase.co;
  connect-src 'self' 
    https://*.supabase.co;
  frame-src 'self' 
    https://www.google.com;
  frame-ancestors 'none';
  object-src 'none';
```

#### 許可されたドメイン
- **Google Services**: reCAPTCHA、フォント
- **Supabase**: データベース、ストレージ
- **GitHub**: OAuth認証
- **自ドメイン**: 内部リソース

### **4. セキュリティヘッダー**

#### 完全なセキュリティヘッダー設定
```typescript
// 包括的なセキュリティヘッダー
'X-Content-Type-Options': 'nosniff',
'X-Frame-Options': 'DENY', 
'X-XSS-Protection': '1; mode=block',
'Referrer-Policy': 'strict-origin-when-cross-origin',
'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
'Cross-Origin-Embedder-Policy': 'require-corp',
'Cross-Origin-Opener-Policy': 'same-origin'
```

## 🔧 使用方法

### **API側での自動サニタイズ**
```typescript
// API route での使用例
import { sanitizeAllTextInputs } from '@/lib/inputSanitization';

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // 全入力を自動サニタイズ
  const sanitized = sanitizeAllTextInputs(body);
  
  // サニタイズ済みデータを使用
  const result = await generateImage(sanitized.prompt);
  
  return NextResponse.json(result);
}
```

### **フロントエンド側での事前チェック**
```typescript
// React コンポーネントでの使用
import { validateUserInput, escapeHtml } from '@/lib/htmlEscape';

function InputForm() {
  const [prompt, setPrompt] = useState('');
  
  const handleInputChange = (value: string) => {
    const validation = validateUserInput(value, {
      maxLength: 1000,
      allowHtml: false
    });
    
    if (validation.isValid) {
      setPrompt(validation.sanitized);
    }
  };
  
  return (
    <input 
      value={prompt}
      onChange={(e) => handleInputChange(e.target.value)}
      placeholder="安全にサニタイズされます..."
    />
  );
}
```

### **表示時の安全な処理**
```typescript
// サニタイズ済みデータの表示
function DisplayContent({ userContent }: { userContent: string }) {
  return (
    <div>
      {/* 自動エスケープ済み */}
      <p>{userContent}</p>
      
      {/* HTMLが必要な場合 */}
      <div dangerouslySetInnerHTML={
        sanitizeForDangerouslySetInnerHTML(userContent)
      } />
    </div>
  );
}
```

## 🧪 セキュリティテスト

### **テスト実行**
```bash
# 包括的なセキュリティテスト
npm run test:security

# 個別テスト
npm run test:rate-limit  # レート制限テスト
```

### **テスト項目**
1. **XSS注入テスト**: 悪意のあるスクリプトが実行されないか
2. **HTMLインジェクション**: 不正なHTMLタグが挿入されないか
3. **セキュリティヘッダー**: 適切なヘッダーが設定されているか
4. **HTTPS強制**: HTTP→HTTPS リダイレクトが動作するか
5. **CSP違反**: 不正な外部リソース読み込みがブロックされるか

### **テスト例**
```javascript
// 悪意のある入力のテスト
const maliciousInputs = [
  '<script>alert("XSS")</script>',
  'javascript:alert("XSS")',
  '<img src=x onerror=alert("XSS")>',
  '"><script>alert("XSS")</script>',
  '<svg onload=alert("XSS")>'
];

// これらの入力がすべて安全にエスケープされることを確認
```

## 🌐 本番環境設定

### **Vercel設定**
```javascript
// vercel.json (オプション)
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains; preload"
        }
      ]
    }
  ]
}
```

### **環境変数**
```env
# セキュリティ設定
NODE_ENV=production
NEXT_PUBLIC_APP_ENV=production
ENFORCE_HTTPS=true
CSP_REPORT_URI=https://your-domain.com/api/csp-report
```

### **DNS設定**
```
# HSTS Preload用の設定
your-domain.com. IN TXT "v=STSv1; preload;"
```

## 🔍 セキュリティ監視

### **CSP違反レポート**
```typescript
// CSP違反を監視
export async function POST(request: NextRequest) {
  const report = await request.json();
  
  // セキュリティログに記録
  console.log('CSP Violation:', {
    blockedURI: report['blocked-uri'],
    violatedDirective: report['violated-directive'],
    userAgent: request.headers.get('user-agent')
  });
  
  return NextResponse.json({ received: true });
}
```

### **セキュリティログ**
```typescript
// セキュリティイベントの記録
logSecurityEvent({
  type: 'suspicious_input',
  details: 'XSS attempt detected',
  ip: getClientIP(request),
  endpoint: request.nextUrl.pathname
});
```

## ✅ セキュリティチェックリスト

### **実装確認**
- [ ] すべてのユーザー入力がHTMLエスケープされている
- [ ] 本番環境でHTTPS強制が有効
- [ ] CSPヘッダーが適切に設定されている
- [ ] セキュリティヘッダーがすべて設定されている
- [ ] 悪意のある入力に対するテストが通る

### **設定確認**
- [ ] Next.js設定でセキュリティヘッダーが設定済み
- [ ] ミドルウェアでHTTPS強制が実装済み
- [ ] 許可ドメインリストが最小限に制限されている
- [ ] 開発環境と本番環境で適切に設定が切り替わる

### **テスト確認**  
- [ ] `npm run test:security` がすべて通る
- [ ] ブラウザでCSP違反が発生しない
- [ ] HTTPアクセスが自動でHTTPSにリダイレクトされる
- [ ] 悪意のある入力が適切にブロックされる

この包括的なセキュリティ実装により、XSS、HTMLインジェクション、中間者攻撃などの主要な脅威から保護されます！