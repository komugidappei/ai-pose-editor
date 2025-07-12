/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// CSP設定
const cspHeader = `
  default-src 'self';
  script-src 'self' ${isDev ? "'unsafe-eval' 'unsafe-inline'" : "'unsafe-inline'"} 
    https://www.google.com 
    https://www.gstatic.com 
    https://www.recaptcha.net 
    https://apis.google.com
    https://vitals.vercel-analytics.com;
  style-src 'self' 'unsafe-inline' 
    https://fonts.googleapis.com;
  font-src 'self' 
    https://fonts.gstatic.com;
  img-src 'self' data: blob: 
    https://*.supabase.co 
    https://*.supabase.in 
    https://lh3.googleusercontent.com 
    https://avatars.githubusercontent.com 
    https://www.google.com 
    https://www.gstatic.com;
  connect-src 'self' 
    https://*.supabase.co 
    https://*.supabase.in 
    https://www.google.com 
    https://www.recaptcha.net 
    https://accounts.google.com 
    https://api.github.com
    ${isDev ? 'ws://localhost:* wss://localhost:*' : ''};
  frame-src 'self' 
    https://www.google.com 
    https://www.recaptcha.net;
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  ${isProduction ? 'upgrade-insecure-requests;' : ''}
`.replace(/\s{2,}/g, ' ').trim();

const nextConfig = {
  // 基本設定
  reactStrictMode: true,
  
  // 実験的機能
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },

  // セキュリティヘッダー
  async headers() {
    const securityHeaders = [
      // CSP
      {
        key: 'Content-Security-Policy',
        value: cspHeader,
      },
      // XSS Protection
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-Frame-Options', 
        value: 'DENY',
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
      },
      // Referrer Policy
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      // Permissions Policy
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()',
      },
    ];

    // 本番環境のみのヘッダー
    if (isProduction) {
      securityHeaders.push(
        // HSTS
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload',
        },
        // Cross-Origin Policies
        {
          key: 'Cross-Origin-Embedder-Policy',
          value: 'require-corp',
        },
        {
          key: 'Cross-Origin-Opener-Policy',
          value: 'same-origin',
        },
        // Expect-CT
        {
          key: 'Expect-CT',
          value: 'max-age=86400, enforce',
        }
      );
    }

    return [
      {
        // すべてのルートに適用
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  // リダイレクト設定
  async redirects() {
    const redirects = [];

    // 本番環境でHTTPS強制
    if (isProduction) {
      redirects.push({
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://your-domain.com/:path*',
        permanent: true,
      });
    }

    return redirects;
  },

  // 画像最適化設定
  images: {
    domains: [
      'lh3.googleusercontent.com', // Google
      'avatars.githubusercontent.com', // GitHub
      // Supabase Storage
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL && 
          process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your-supabase-project-url' &&
          process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')
        ? [new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname]
        : []
      ),
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  // Webpack設定
  webpack: (config, { dev, isServer }) => {
    // 本番環境でのセキュリティ強化
    if (!dev) {
      config.optimization.minimize = true;
    }

    // ファイルサイズ警告の調整
    config.performance = {
      maxAssetSize: 250000,
      maxEntrypointSize: 250000,
      hints: isProduction ? 'warning' : false,
    };

    return config;
  },

  // 環境変数設定
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // TypeScript設定
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint設定
  eslint: {
    ignoreDuringBuilds: false,
  },

  // トレイリングスラッシュ
  trailingSlash: false,

  // 静的エクスポート設定（必要に応じて）
  output: process.env.NEXT_OUTPUT === 'export' ? 'export' : undefined,

  // Vercel設定
  ...(process.env.VERCEL && {
    // Vercel固有の設定
    generateBuildId: async () => {
      return process.env.VERCEL_GIT_COMMIT_SHA || 'local-build';
    },
  }),
};

module.exports = nextConfig;