#!/bin/bash

echo "🚀 AI Pose Editor - Quick Deploy Script"
echo "======================================"

# GitHubリポジトリURL入力
echo "📝 GitHubリポジトリのURLを入力してください（例: https://github.com/username/ai-pose-editor.git）"
read -p "Repository URL: " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo "❌ リポジトリURLが入力されていません"
    exit 1
fi

# Git初期化とプッシュ
echo "📤 GitHubにコードをアップロード中..."

# .gitignoreがない場合は作成
if [ ! -f .gitignore ]; then
    echo "📄 .gitignore ファイルを作成中..."
    cat > .gitignore << EOL
# Dependencies
node_modules/
.pnp
.pnp.js

# Production
/build
/.next/
/out/

# Runtime data
.vercel/

# Environment variables
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Testing
coverage/

# Cache
.eslintcache
EOL
fi

# Git初期化
if [ ! -d .git ]; then
    git init
fi

# ファイル追加
git add .

# コミット
git commit -m "🚀 Initial commit - AI Pose Editor with full security implementation

Features:
✅ Google reCAPTCHA v2 integration
✅ Image limit (10 images with auto-deletion)
✅ HTML escaping (XSS prevention)
✅ Daily rate limiting (10 generations/day)
✅ Signed URLs for private storage
✅ Image re-encoding with EXIF removal
✅ Watermark for free users

Ready for production deployment!"

# リモートリポジトリ設定
git branch -M main
git remote add origin $REPO_URL

# プッシュ
echo "⬆️ GitHubにプッシュ中..."
git push -u origin main

echo "✅ GitHubアップロード完了!"
echo ""
echo "🌐 次のステップ:"
echo "1. Vercelにアクセス: https://vercel.com/dashboard"
echo "2. 'Add New Project' をクリック"
echo "3. GitHubリポジトリを選択"
echo "4. 環境変数を設定"
echo "5. Deploy!"
echo ""
echo "📋 必要な環境変数は deploy-guide.md を確認してください"