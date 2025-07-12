# 🚀 PoseCrafter AI ポーズエディター デプロイガイド

## 📋 デプロイ前チェックリスト

### ✅ 必要なアカウント
- [ ] Vercel アカウント
- [ ] Supabase プロジェクト
- [ ] Google reCAPTCHA v2 サイトキー

### ✅ 環境変数準備
- [ ] Supabase URL & Keys
- [ ] reCAPTCHA Site Key & Secret
- [ ] セキュリティトークン

## 🛠️ 1. Supabaseセットアップ

### データベーステーブル作成
```sql
-- Supabase SQL エディターで実行
-- 1. 日次制限テーブル
-- database/daily-generation-limit-schema.sql をコピー&実行

-- 2. 画像管理テーブル（既存の場合はスキップ）
CREATE TABLE IF NOT EXISTS generated_images (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id text NOT NULL,
    prompt text,
    image_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. RLS有効化
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_generation_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_generation_stats ENABLE ROW LEVEL SECURITY;
```

### ストレージバケット作成
```sql
-- private-images バケット作成
INSERT INTO storage.buckets (id, name, public) 
VALUES ('private-images', 'private-images', false);

-- RLSポリシー設定
CREATE POLICY "Users can access own images" ON storage.objects
FOR ALL USING (auth.uid()::text = (storage.foldername(name))[1]);
```

## 🔐 2. Google reCAPTCHA設定

### reCAPTCHA v2サイト登録
1. [Google reCAPTCHA](https://www.google.com/recaptcha/admin) にアクセス
2. 新しいサイト追加
3. reCAPTCHA v2 選択
4. ドメイン追加（例: your-site.vercel.app）
5. サイトキーとシークレットキーを取得

## ⚡ 3. Vercelデプロイ

### 3-1. GitHub連携
```bash
# リポジトリをGitHubにプッシュ
git add .
git commit -m "🚀 Ready for deployment with full security implementation"
git push origin main
```

### 3-2. Vercel設定
1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
2. 「New Project」をクリック
3. GitHubリポジトリを選択
4. 環境変数を設定：

```env
# 🔑 Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 🛡️ reCAPTCHA
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6LfXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
RECAPTCHA_SECRET_KEY=6LfXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# 🔒 セキュリティ
CRON_SECRET=your-secure-random-string
ADMIN_API_KEY=your-admin-api-key

# 🌐 環境
NODE_ENV=production
```

### 3-3. デプロイ実行
5. 「Deploy」をクリック
6. ビルド完了まで待機（約2-3分）

## 🔧 4. デプロイ後設定

### 4-1. Cron ジョブ設定
- Vercelが自動的に `vercel.json` の cron 設定を認識
- 毎日午前2時に古いレコードを自動削除

### 4-2. ドメイン設定（オプション）
1. Vercel Dashboard → Project → Settings → Domains
2. カスタムドメイン追加
3. DNS設定（CNAMEレコード追加）

### 4-3. reCAPTCHA ドメイン更新
1. Google reCAPTCHA Console
2. デプロイされたドメインを追加
3. localhost も開発用に保持

## 🧪 5. デプロイ確認テスト

### 基本機能テスト
- [ ] トップページが正常に表示される
- [ ] ユーザー登録・ログインが動作する
- [ ] ポーズエディターが読み込まれる

### セキュリティ機能テスト
- [ ] ゲストユーザーでreCAPTCHA表示される
- [ ] 画像生成が正常に動作する
- [ ] 日次制限（10回）が機能する
- [ ] HTMLエスケープが動作する
- [ ] 署名付きURLでの画像表示
- [ ] ウォーターマーク表示

### テストページアクセス
```
https://your-site.vercel.app/test/watermark
```

## 🚨 6. トラブルシューティング

### よくある問題

#### ビルドエラー
```bash
# 依存関係の問題
npm install --legacy-peer-deps
npm run build
```

#### 環境変数エラー
- Vercel Dashboard で環境変数を再確認
- プロダクション環境で再デプロイ

#### Supabase接続エラー
- URL/キーの正確性を確認
- RLSポリシーの設定確認

#### reCAPTCHA エラー
- ドメイン設定の確認
- キーペアの正確性確認

### ログ確認方法
```bash
# Vercel CLI使用
vercel logs your-project-name

# またはダッシュボードの Functions タブ
```

## 📊 7. 監視・メンテナンス

### パフォーマンス監視
- Vercel Analytics 有効化
- Core Web Vitals 確認

### セキュリティ監視
- 不正アクセス検知
- API制限の調整

### 定期メンテナンス
- 古いデータのクリーンアップ（自動化済み）
- ログの確認
- セキュリティアップデート

## 🎯 8. 本番運用のベストプラクティス

### セキュリティ
- [ ] HTTPS強制（Vercelデフォルト）
- [ ] CSP（Content Security Policy）設定
- [ ] Rate Limiting監視

### パフォーマンス
- [ ] 画像最適化（Next.js Image）
- [ ] CDN活用（Vercelデフォルト）
- [ ] キャッシュ戦略

### スケーラビリティ
- [ ] Supabaseプラン確認
- [ ] Vercel使用量監視
- [ ] ユーザー増加に応じた制限調整

## 📞 サポート情報

### 公式ドキュメント
- [Vercel Deployment](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Next.js Production](https://nextjs.org/docs/deployment)

### 緊急時対応
- Vercel Status: https://vercel-status.com/
- Supabase Status: https://status.supabase.com/

---

## 🚀 クイックデプロイ

最速でデプロイしたい場合：

1. **Supabase**: 上記SQLを実行
2. **reCAPTCHA**: サイトキー取得
3. **Vercel**: GitHub連携 + 環境変数設定
4. **デプロイ**: 自動ビルド開始

**所要時間: 約15-30分で完全デプロイ完了！**

---

💡 **サポートが必要な場合は、具体的なエラーメッセージと共にお知らせください。**