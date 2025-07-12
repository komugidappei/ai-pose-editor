'use client';

import { useState, useEffect } from 'react';
import { 
  signInWithGoogle, 
  signInWithGitHub, 
  signInWithEmail,
  signOut, 
  getCurrentUser, 
  onAuthStateChange,
  getProviderInfo,
  SessionManager,
  type AuthUser 
} from '@/lib/supabaseAuth';

interface AuthButtonProps {
  onAuthChange?: (user: AuthUser | null) => void;
  className?: string;
  showEmailLogin?: boolean;
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: AuthUser) => void;
  showEmailLogin?: boolean;
}

// セッション期限警告モーダル
function SessionWarningModal({ 
  isOpen, 
  minutesLeft, 
  onExtend, 
  onLogout 
}: {
  isOpen: boolean;
  minutesLeft: number;
  onExtend: () => void;
  onLogout: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-2">⏰</span>
          <h3 className="text-lg font-semibold">セッション期限が近づいています</h3>
        </div>
        
        <p className="text-gray-600 mb-6">
          ログインセッションが約{minutesLeft}分で期限切れになります。
          作業を続ける場合は「延長」をクリックしてください。
        </p>
        
        <div className="flex space-x-3">
          <button
            onClick={onExtend}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition-colors"
          >
            セッション延長
          </button>
          <button
            onClick={onLogout}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded transition-colors"
          >
            ログアウト
          </button>
        </div>
      </div>
    </div>
  );
}

// ログインモーダル
function LoginModal({ isOpen, onClose, onAuthSuccess, showEmailLogin = false }: LoginModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmail, setShowEmail] = useState(false);

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setLoading(true);
    setError(null);

    try {
      const result = provider === 'google' 
        ? await signInWithGoogle()
        : await signInWithGitHub();

      if (!result.success) {
        throw new Error(result.error);
      }

      // OAuth の場合、リダイレクトが発生するので、ここではユーザー情報を直接取得しない
      // リダイレクト後に auth/callback でハンドリング

    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signInWithEmail(email, password);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      const { user } = await getCurrentUser();
      if (user) {
        onAuthSuccess(user);
        onClose();
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">ログイン</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* OAuth ボタン */}
          <button
            onClick={() => handleOAuthLogin('google')}
            disabled={loading}
            className="w-full flex items-center justify-center py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span className="mr-2">🔗</span>
            Googleでログイン
          </button>

          <button
            onClick={() => handleOAuthLogin('github')}
            disabled={loading}
            className="w-full flex items-center justify-center py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span className="mr-2">🐱</span>
            GitHubでログイン
          </button>

          {/* メールログイン（オプション） */}
          {showEmailLogin && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">または</span>
                </div>
              </div>

              {!showEmail ? (
                <button
                  onClick={() => setShowEmail(true)}
                  className="w-full py-3 px-4 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  📧 メールアドレスでログイン
                </button>
              ) : (
                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <input
                    type="email"
                    placeholder="メールアドレス"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="password"
                    placeholder="パスワード"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading ? 'ログイン中...' : 'ログイン'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>セキュリティのため、セッションは1時間で自動的に期限切れになります。</p>
        </div>
      </div>
    </div>
  );
}

export default function AuthButton({ 
  onAuthChange, 
  className = '',
  showEmailLogin = false 
}: AuthButtonProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [sessionMinutesLeft, setSessionMinutesLeft] = useState(15);
  const [sessionManager] = useState(new SessionManager());

  // 初期化とユーザー状態監視
  useEffect(() => {
    let mounted = true;

    // 初期ユーザー取得
    async function checkInitialUser() {
      const { user } = await getCurrentUser();
      if (mounted) {
        setUser(user);
        setLoading(false);
        onAuthChange?.(user);
      }
    }

    checkInitialUser();

    // 認証状態変更の監視
    const { data: { subscription } } = onAuthStateChange((newUser, event) => {
      if (mounted) {
        setUser(newUser);
        setLoading(false);
        onAuthChange?.(newUser);

        // ログイン成功時にセッション管理開始
        if (newUser && event === 'SIGNED_IN') {
          startSessionManagement();
        }

        // ログアウト時にセッション管理停止
        if (!newUser && event === 'SIGNED_OUT') {
          sessionManager.stop();
          setShowSessionWarning(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      sessionManager.stop();
    };
  }, [onAuthChange, sessionManager]);

  // セッション管理開始
  const startSessionManagement = () => {
    sessionManager.start(
      // セッション期限切れ時
      () => {
        setShowSessionWarning(false);
        handleLogout();
      },
      // 期限警告時
      (minutesLeft) => {
        setSessionMinutesLeft(minutesLeft);
        setShowSessionWarning(true);
      }
    );
  };

  // ログアウト処理
  const handleLogout = async () => {
    setLoading(true);
    sessionManager.stop();
    setShowSessionWarning(false);
    
    const result = await signOut();
    if (!result.success) {
      console.error('Logout error:', result.error);
    }
    
    setLoading(false);
  };

  // ログイン成功処理
  const handleAuthSuccess = (authUser: AuthUser) => {
    setUser(authUser);
    setShowLoginModal(false);
    startSessionManagement();
    onAuthChange?.(authUser);
  };

  // セッション延長処理
  const handleSessionExtend = async () => {
    const result = await import('@/lib/supabaseAuth').then(m => m.refreshSession());
    if (result.success) {
      setShowSessionWarning(false);
      // セッション管理を再開
      sessionManager.stop();
      startSessionManagement();
    } else {
      // リフレッシュ失敗時はログアウト
      handleLogout();
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center ${className}`}>
        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        <span className="ml-2 text-sm text-gray-600">読み込み中...</span>
      </div>
    );
  }

  if (user) {
    const providerInfo = getProviderInfo(user);
    
    return (
      <>
        <div className={`flex items-center space-x-3 ${className}`}>
          {/* ユーザー情報 */}
          <div className="flex items-center space-x-2">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || 'User'}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-sm">
                  {user.name?.charAt(0) || '?'}
                </span>
              </div>
            )}
            
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500 flex items-center">
                <span className="mr-1">{providerInfo.icon}</span>
                {providerInfo.providerName}
              </p>
            </div>
          </div>

          {/* ログアウトボタン */}
          <button
            onClick={handleLogout}
            disabled={loading}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            ログアウト
          </button>
        </div>

        {/* セッション警告モーダル */}
        <SessionWarningModal
          isOpen={showSessionWarning}
          minutesLeft={sessionMinutesLeft}
          onExtend={handleSessionExtend}
          onLogout={handleLogout}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowLoginModal(true)}
        className={`px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors ${className}`}
      >
        ログイン
      </button>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onAuthSuccess={handleAuthSuccess}
        showEmailLogin={showEmailLogin}
      />
    </>
  );
}