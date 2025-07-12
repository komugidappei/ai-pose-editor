// OAuth認証後のコールバック処理
// Google/GitHub認証後のリダイレクト先

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // エラーがある場合
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    
    // エラーページにリダイレクト（クエリパラメータでエラー情報を渡す）
    const errorUrl = new URL('/auth/error', requestUrl.origin);
    errorUrl.searchParams.set('error', error);
    if (errorDescription) {
      errorUrl.searchParams.set('description', errorDescription);
    }
    
    return NextResponse.redirect(errorUrl);
  }

  if (code) {
    try {
      const supabase = createRouteHandlerClient({ cookies });
      
      // 認証コードをセッションに交換
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      
      if (exchangeError) {
        throw exchangeError;
      }

      if (data.session) {
        console.log('OAuth login successful:', {
          userId: data.user?.id,
          email: data.user?.email,
          provider: data.user?.app_metadata?.provider
        });

        // セッション情報をログ（開発時のみ）
        if (process.env.NODE_ENV === 'development') {
          console.log('Session expires at:', new Date(data.session.expires_at! * 1000));
        }

        // メインページにリダイレクト
        const redirectUrl = new URL('/', requestUrl.origin);
        redirectUrl.searchParams.set('auth', 'success');
        
        return NextResponse.redirect(redirectUrl);
      }

    } catch (error) {
      console.error('OAuth callback error:', error);
      
      // エラーページにリダイレクト
      const errorUrl = new URL('/auth/error', requestUrl.origin);
      errorUrl.searchParams.set('error', 'callback_error');
      errorUrl.searchParams.set('description', error instanceof Error ? error.message : '認証処理に失敗しました');
      
      return NextResponse.redirect(errorUrl);
    }
  }

  // コードがない場合は不正なリクエスト
  const errorUrl = new URL('/auth/error', requestUrl.origin);
  errorUrl.searchParams.set('error', 'invalid_request');
  errorUrl.searchParams.set('description', '認証コードが見つかりません');
  
  return NextResponse.redirect(errorUrl);
}