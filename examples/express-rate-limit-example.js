// Express.js での同等のレート制限実装例
// このファイルは参考用です（実際にはNext.jsを使用）

const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();

// 基本的なレート制限設定（提供されたコード例と同等）
const basicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分間
  max: 5, // IPごとに最大5回
  message: 'アクセス回数が多すぎます。少し待ってからもう一度お試しください。',
  standardHeaders: true, // レート制限情報をヘッダーに追加
  legacyHeaders: false, // X-RateLimit-* ヘッダーを無効化
});

// 画像生成用の厳しいレート制限
const imageGenerationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分間
  max: 5, // 最大5回
  message: {
    error: '画像生成の回数制限に達しました。1分後に再試行してください。',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// アップロード用のレート制限
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分間
  max: 3, // 最大3回
  message: {
    error: 'アップロード回数が多すぎます。少し待ってから再試行してください。',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// グローバルレート制限（全エンドポイント）
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分間
  max: 20, // 最大20回
  message: {
    error: 'API使用回数が多すぎます。少し待ってから再試行してください。',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ミドルウェアの適用
app.use('/api/', globalLimiter); // 全APIに適用

// 個別エンドポイントのレート制限
app.use('/api/generate', imageGenerationLimiter);
app.use('/api/generate-secure', imageGenerationLimiter);
app.use('/api/pose', uploadLimiter);

// Express.js ルート例
app.post('/api/generate', (req, res) => {
  // 画像生成ロジック
  res.json({
    success: true,
    message: '画像生成が完了しました'
  });
});

app.post('/api/pose', (req, res) => {
  // ポーズ検出ロジック
  res.json({
    success: true,
    keypoints: []
  });
});

// カスタムエラーハンドラー
app.use((err, req, res, next) => {
  if (err.status === 429) {
    res.status(429).json({
      error: err.message,
      retryAfter: Math.round(err.resetTime / 1000)
    });
  } else {
    next(err);
  }
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Express.js server running on port ${PORT}`);
  console.log('📊 Rate limiting enabled:');
  console.log('  - Global: 20 requests/minute');
  console.log('  - Image generation: 5 requests/minute');
  console.log('  - Upload: 3 requests/minute');
});

module.exports = app;