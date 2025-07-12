import Link from 'next/link';
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-xl font-bold text-gray-800">
              AI Pose Editor
            </Link>
            <div className="flex items-center space-x-6">
              <Link 
                href="/upload" 
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                アップロード
              </Link>
              <Link 
                href="/viewer" 
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                エディター
              </Link>
              <Link 
                href="/viewer?tab=interpolation" 
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                🔀 ポーズ補間
              </Link>
              <Link 
                href="/templates" 
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                テンプレート
              </Link>
              <Link 
                href="/prompts" 
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                プロンプト
              </Link>
              <Link 
                href="/prompt-builder" 
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                組み合わせ
              </Link>
              <Link 
                href="/ai-styles" 
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                AIスタイル
              </Link>
              <Link 
                href="/gallery" 
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                ギャラリー
              </Link>
              <Link 
                href="/dashboard" 
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                ダッシュボード
              </Link>
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
                ログイン
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="flex-1">
        {children}
      </main>
      
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-600">
            <p>&copy; 2024 AI Pose Editor. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}