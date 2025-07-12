// シンプルなSupabase Auth（直接アプローチベース）
// あなたの例をベースにした簡易版

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

/**
 * Googleでサインイン（シンプル版）
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });

  if (error) {
    console.error('Google sign-in error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

/**
 * GitHubでサインイン（シンプル版）
 */
export async function signInWithGitHub() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
  });

  if (error) {
    console.error('GitHub sign-in error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

/**
 * サインアウト
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Sign-out error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 現在のユーザー取得
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Get user error:', error);
    return { user: null, error: error.message };
  }

  return { user, error: null };
}

/**
 * 認証状態監視（シンプル版）
 */
export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event);
    callback(session?.user || null);
  });
}

/**
 * シンプルな認証ボタンコンポーネント
 */
import { useState, useEffect } from 'react';

export function SimpleAuthButton() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初期ユーザー確認
    getCurrentUser().then(({ user }) => {
      setUser(user);
      setLoading(false);
    });

    // 認証状態監視
    const { data: { subscription } } = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    await signInWithGoogle();
    // リダイレクトが発生するのでloadingはそのまま
  };

  const handleGitHubLogin = async () => {
    setLoading(true);
    await signInWithGitHub();
  };

  const handleLogout = async () => {
    setLoading(true);
    await signOut();
    setLoading(false);
  };

  if (loading) {
    return <div>読み込み中...</div>;
  }

  if (user) {
    return (
      <div className="flex items-center space-x-4">
        <span>こんにちは、{user.email}</span>
        <button 
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <div className="space-x-2">
      <button 
        onClick={handleGoogleLogin}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        🔗 Googleでログイン
      </button>
      <button 
        onClick={handleGitHubLogin}
        className="px-4 py-2 bg-gray-800 text-white rounded"
      >
        🐱 GitHubでログイン
      </button>
    </div>
  );
}

/**
 * セッション有効期限チェック（シンプル版）
 */
export async function checkSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    return { isValid: false };
  }

  // 1時間後にチェック
  const expiresAt = new Date(session.expires_at! * 1000);
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 3600 * 1000);

  const isValid = expiresAt > now;
  const expiresSoon = expiresAt < oneHourLater;

  return { 
    isValid, 
    expiresSoon,
    expiresAt: expiresAt.toLocaleString(),
    user: session.user 
  };
}

/**
 * Reactフック版
 */
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then(({ user }) => {
      setUser(user);
      setLoading(false);
    });

    const { data: { subscription } } = onAuthStateChange(setUser);
    return () => subscription.unsubscribe();
  }, []);

  return { 
    user, 
    loading, 
    signInWithGoogle, 
    signInWithGitHub, 
    signOut 
  };
}

// 使用例:
/*
// 1. 直接使用
await signInWithGoogle();

// 2. Reactコンポーネント
<SimpleAuthButton />

// 3. フック使用
const { user, signInWithGoogle } = useAuth();

// 4. セッション確認
const { isValid, expiresSoon } = await checkSession();
*/