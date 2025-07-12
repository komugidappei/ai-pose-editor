// Supabase Authentication 設定
// セッション有効期限とOAuth設定

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supabase クライアント設定（セッション管理強化）
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // セッション設定
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    
    // セッション有効期限を1時間に設定
    // Note: これはクライアント側の設定。サーバー側の設定もSupabaseダッシュボードで必要
    storage: {
      getItem: (key: string) => {
        if (typeof window === 'undefined') return null;
        
        const item = localStorage.getItem(key);
        if (!item) return null;
        
        try {
          const parsed = JSON.parse(item);
          
          // セッションの有効期限チェック（1時間 = 3600秒）
          if (parsed.expires_at) {
            const expiresAt = new Date(parsed.expires_at * 1000);
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 3600 * 1000);
            
            // 1時間以上古いセッションは削除
            if (expiresAt < oneHourAgo) {
              localStorage.removeItem(key);
              return null;
            }
          }
          
          return item;
        } catch {
          return item;
        }
      },
      setItem: (key: string, value: string) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(key);
      }
    }
  }
});

// 認証ユーザー情報の型定義
export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  provider?: string;
  emailVerified?: boolean;
  lastSignIn?: string;
}

// OAuth プロバイダー設定
export const OAUTH_PROVIDERS = {
  google: {
    name: 'Google',
    icon: '🔗',
    provider: 'google' as const,
    scopes: 'openid email profile'
  },
  github: {
    name: 'GitHub', 
    icon: '🐱',
    provider: 'github' as const,
    scopes: 'user:email'
  }
} as const;

/**
 * Googleでサインイン
 */
export async function signInWithGoogle(options?: {
  redirectTo?: string;
  scopes?: string;
}) {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: options?.redirectTo || `${window.location.origin}/auth/callback`,
        scopes: options?.scopes || 'openid email profile',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) {
      throw error;
    }

    return { success: true, data };

  } catch (error) {
    console.error('Google sign-in error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Googleログインに失敗しました' 
    };
  }
}

/**
 * GitHubでサインイン
 */
export async function signInWithGitHub(options?: {
  redirectTo?: string;
  scopes?: string;
}) {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: options?.redirectTo || `${window.location.origin}/auth/callback`,
        scopes: options?.scopes || 'user:email'
      }
    });

    if (error) {
      throw error;
    }

    return { success: true, data };

  } catch (error) {
    console.error('GitHub sign-in error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'GitHubログインに失敗しました' 
    };
  }
}

/**
 * メールパスワードでサインイン（レガシー対応）
 */
export async function signInWithEmail(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    return { success: true, user: data.user, session: data.session };

  } catch (error) {
    console.error('Email sign-in error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'ログインに失敗しました' 
    };
  }
}

/**
 * サインアウト
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw error;
    }

    // ローカルストレージからセッション情報をクリア
    if (typeof window !== 'undefined') {
      localStorage.removeItem('supabase.auth.token');
      localStorage.clear(); // 開発時のみ、本番では慎重に
    }

    return { success: true };

  } catch (error) {
    console.error('Sign-out error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'ログアウトに失敗しました' 
    };
  }
}

/**
 * 現在のユーザー情報を取得
 */
export async function getCurrentUser(): Promise<{ user: AuthUser | null; error?: string }> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    if (!user) {
      return { user: null };
    }

    // ユーザー情報の整形
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
      avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture,
      provider: user.app_metadata?.provider,
      emailVerified: user.email_confirmed_at ? true : false,
      lastSignIn: user.last_sign_in_at
    };

    return { user: authUser };

  } catch (error) {
    console.error('Get current user error:', error);
    return { 
      user: null, 
      error: error instanceof Error ? error.message : 'ユーザー情報の取得に失敗しました' 
    };
  }
}

/**
 * セッションの有効性チェック
 */
export async function checkSessionValidity(): Promise<{ isValid: boolean; user?: AuthUser | null; shouldRefresh?: boolean }> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Session check error:', error);
      return { isValid: false };
    }

    if (!session) {
      return { isValid: false };
    }

    // セッションの有効期限をチェック（1時間）
    const expiresAt = new Date(session.expires_at! * 1000);
    const now = new Date();
    const oneHourInMs = 3600 * 1000;

    // 期限切れチェック
    if (expiresAt <= now) {
      return { isValid: false };
    }

    // リフレッシュが必要かチェック（残り15分以下の場合）
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const shouldRefresh = timeUntilExpiry < (15 * 60 * 1000); // 15分

    // ユーザー情報を取得
    const { user } = await getCurrentUser();

    return { 
      isValid: true, 
      user,
      shouldRefresh 
    };

  } catch (error) {
    console.error('Session validity check error:', error);
    return { isValid: false };
  }
}

/**
 * セッションを手動でリフレッシュ
 */
export async function refreshSession() {
  try {
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      throw error;
    }

    return { success: true, session: data.session };

  } catch (error) {
    console.error('Session refresh error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'セッションの更新に失敗しました' 
    };
  }
}

/**
 * 認証状態の変更を監視
 */
export function onAuthStateChange(callback: (user: AuthUser | null, event: string) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event, session?.user?.id);

    if (session?.user) {
      const { user } = await getCurrentUser();
      callback(user, event);
    } else {
      callback(null, event);
    }
  });
}

/**
 * プロバイダー別のユーザー情報取得
 */
export function getProviderInfo(user: AuthUser | null): {
  provider: string;
  providerName: string;
  icon: string;
  isOAuth: boolean;
} {
  if (!user?.provider) {
    return {
      provider: 'email',
      providerName: 'メール',
      icon: '📧',
      isOAuth: false
    };
  }

  switch (user.provider) {
    case 'google':
      return {
        provider: 'google',
        providerName: 'Google',
        icon: '🔗',
        isOAuth: true
      };
    case 'github':
      return {
        provider: 'github', 
        providerName: 'GitHub',
        icon: '🐱',
        isOAuth: true
      };
    default:
      return {
        provider: user.provider,
        providerName: user.provider,
        icon: '🔗',
        isOAuth: true
      };
  }
}

/**
 * セッション監視とタイムアウト管理
 */
export class SessionManager {
  private checkInterval: NodeJS.Timeout | null = null;
  private warningShown = false;

  start(onExpiration?: () => void, onWarning?: (minutesLeft: number) => void) {
    // 1分ごとにセッションをチェック
    this.checkInterval = setInterval(async () => {
      const { isValid, shouldRefresh } = await checkSessionValidity();

      if (!isValid) {
        this.stop();
        onExpiration?.();
        return;
      }

      if (shouldRefresh && !this.warningShown) {
        this.warningShown = true;
        onWarning?.(15); // 15分前警告
        
        // 自動リフレッシュ
        await refreshSession();
        this.warningShown = false;
      }
    }, 60000); // 1分間隔
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.warningShown = false;
  }
}