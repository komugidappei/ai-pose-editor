// ユーザー認証状態判定とゲストユーザー管理
// reCAPTCHA条件分岐の基盤ロジック

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface UserAuthState {
  isAuthenticated: boolean;
  isGuest: boolean;
  userId: string;
  userEmail?: string;
  userRole?: 'guest' | 'free' | 'premium' | 'pro';
  sessionExpiry?: Date;
  requiresRecaptcha: boolean;
}

/**
 * 現在のユーザー認証状態を取得
 */
export async function getCurrentUserAuthState(): Promise<UserAuthState> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session || !session.user) {
      // ゲストユーザー
      return {
        isAuthenticated: false,
        isGuest: true,
        userId: 'guest',
        userRole: 'guest',
        requiresRecaptcha: true, // ゲストユーザーは必須
      };
    }

    // 認証済みユーザー
    const user = session.user;
    
    // ユーザープラン情報を取得
    const { data: userPlan } = await supabase
      .from('user_plans')
      .select('plan_name')
      .eq('user_id', user.id)
      .single();

    const userRole = userPlan?.plan_name?.toLowerCase() || 'free';

    return {
      isAuthenticated: true,
      isGuest: false,
      userId: user.id,
      userEmail: user.email,
      userRole: userRole as 'free' | 'premium' | 'pro',
      sessionExpiry: new Date(session.expires_at! * 1000),
      requiresRecaptcha: false, // 認証済みユーザーは免除
    };

  } catch (error) {
    console.error('Failed to get user auth state:', error);
    
    // エラー時はゲスト扱い
    return {
      isAuthenticated: false,
      isGuest: true,
      userId: 'guest',
      userRole: 'guest',
      requiresRecaptcha: true,
    };
  }
}

/**
 * クライアントサイド用の認証状態フック
 */
export function useUserAuthState() {
  const [authState, setAuthState] = useState<UserAuthState>({
    isAuthenticated: false,
    isGuest: true,
    userId: 'guest',
    userRole: 'guest',
    requiresRecaptcha: true,
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUserAuthState().then(state => {
      setAuthState(state);
      setLoading(false);
    });

    // 認証状態変更の監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const newState = await getCurrentUserAuthState();
        setAuthState(newState);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return {
    ...authState,
    loading,
    refresh: async () => {
      const newState = await getCurrentUserAuthState();
      setAuthState(newState);
    },
  };
}

/**
 * reCAPTCHA要件チェック（特定アクション用）
 */
export function checkRecaptchaRequirement(
  authState: UserAuthState,
  action: 'image_generation' | 'file_upload' | 'comment_post'
): {
  required: boolean;
  reason?: string;
  bypassCondition?: string;
} {
  // 認証済みユーザーは基本的に免除
  if (authState.isAuthenticated) {
    return {
      required: false,
      bypassCondition: 'authenticated_user',
    };
  }

  // ゲストユーザーはアクション別に判定
  switch (action) {
    case 'image_generation':
      return {
        required: true,
        reason: '画像生成にはスパム防止のためreCAPTCHA認証が必要です',
      };
    
    case 'file_upload':
      return {
        required: true,
        reason: 'ファイルアップロードにはreCAPTCHA認証が必要です',
      };
    
    case 'comment_post':
      return {
        required: true,
        reason: 'コメント投稿にはreCAPTCHA認証が必要です',
      };
    
    default:
      return {
        required: false,
        reason: 'このアクションではreCAPTCHA認証は不要です',
      };
  }
}

/**
 * サーバーサイド用：リクエストからユーザー認証状態を取得
 */
export async function getUserAuthStateFromRequest(
  request: Request
): Promise<UserAuthState> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        isAuthenticated: false,
        isGuest: true,
        userId: 'guest',
        userRole: 'guest',
        requiresRecaptcha: true,
      };
    }

    const token = authHeader.substring(7);
    
    // Supabase Service Role クライアントでトークン検証
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return {
        isAuthenticated: false,
        isGuest: true,
        userId: 'guest',
        userRole: 'guest',
        requiresRecaptcha: true,
      };
    }

    // ユーザープラン情報を取得
    const { data: userPlan } = await supabaseAdmin
      .from('user_plans')
      .select('plan_name')
      .eq('user_id', user.id)
      .single();

    const userRole = userPlan?.plan_name?.toLowerCase() || 'free';

    return {
      isAuthenticated: true,
      isGuest: false,
      userId: user.id,
      userEmail: user.email,
      userRole: userRole as 'free' | 'premium' | 'pro',
      requiresRecaptcha: false,
    };

  } catch (error) {
    console.error('Failed to get user auth state from request:', error);
    
    return {
      isAuthenticated: false,
      isGuest: true,
      userId: 'guest',
      userRole: 'guest',
      requiresRecaptcha: true,
    };
  }
}

/**
 * reCAPTCHA検証スキップ条件の確認
 */
export function shouldSkipRecaptcha(
  authState: UserAuthState,
  options?: {
    allowForDevelopment?: boolean;
    allowForTrustedIPs?: boolean;
    trustedIPs?: string[];
    clientIP?: string;
  }
): boolean {
  // 認証済みユーザーは常にスキップ
  if (authState.isAuthenticated) {
    return true;
  }

  // 開発環境でのスキップ
  if (options?.allowForDevelopment && 
      process.env.NODE_ENV === 'development' && 
      process.env.SKIP_RECAPTCHA_IN_DEV === 'true') {
    return true;
  }

  // 信頼できるIPアドレスからのスキップ
  if (options?.allowForTrustedIPs && 
      options.trustedIPs && 
      options.clientIP) {
    const trustedIPs = options.trustedIPs;
    return trustedIPs.includes(options.clientIP);
  }

  return false;
}

/**
 * ユーザー権限レベルの取得
 */
export function getUserPermissionLevel(authState: UserAuthState): {
  level: number;
  name: string;
  permissions: string[];
} {
  const permissions = {
    guest: {
      level: 0,
      name: 'Guest',
      permissions: ['view_public_content'],
    },
    free: {
      level: 1,
      name: 'Free User',
      permissions: [
        'view_public_content',
        'generate_images_limited',
        'save_images_limited',
      ],
    },
    premium: {
      level: 2,
      name: 'Premium User',
      permissions: [
        'view_public_content',
        'generate_images_extended',
        'save_images_extended',
        'commercial_use',
        'no_watermark',
      ],
    },
    pro: {
      level: 3,
      name: 'Pro User',
      permissions: [
        'view_public_content',
        'generate_images_unlimited',
        'save_images_unlimited',
        'commercial_use',
        'no_watermark',
        'api_access',
        'priority_support',
      ],
    },
  };

  return permissions[authState.userRole || 'guest'];
}

// React hooksのインポート
import { useState, useEffect } from 'react';