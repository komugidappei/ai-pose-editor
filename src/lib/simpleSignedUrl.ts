// シンプルな署名付きURL生成（直接Supabaseを使用）
// あなたの例をベースにした簡易版

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service Role使用（プライベートファイルアクセス用）
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * シンプルな署名付きURL生成
 */
export async function createSimpleSignedUrl(
  filePath: string, 
  expiresIn: number = 60
): Promise<{ signedUrl?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .storage
      .from('private-images')
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      return { error: error.message };
    }

    return { signedUrl: data.signedUrl };

  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : '不明なエラー' 
    };
  }
}

/**
 * ユーザー認証付きの署名付きURL生成
 */
export async function createAuthenticatedSignedUrl(
  userId: string,
  filePath: string, 
  expiresIn: number = 60
): Promise<{ signedUrl?: string; error?: string }> {
  
  // セキュリティチェック: ファイルパスがユーザーのものかチェック
  if (!filePath.startsWith(`${userId}/`)) {
    return { error: 'アクセス権限がありません' };
  }

  try {
    const { data, error } = await supabase
      .storage
      .from('private-images')
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      return { error: error.message };
    }

    return { signedUrl: data.signedUrl };

  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : '不明なエラー' 
    };
  }
}

/**
 * 複数ファイルの署名付きURL一括生成
 */
export async function createMultipleSignedUrls(
  filePaths: string[],
  expiresIn: number = 60
): Promise<Array<{ filePath: string; signedUrl?: string; error?: string }>> {
  
  const results = [];

  for (const filePath of filePaths) {
    const { data, error } = await supabase
      .storage
      .from('private-images')
      .createSignedUrl(filePath, expiresIn);

    results.push({
      filePath,
      signedUrl: data?.signedUrl,
      error: error?.message
    });
  }

  return results;
}

/**
 * Reactコンポーネント用のシンプルなフック
 */
import { useState, useEffect } from 'react';

export function useSimpleSignedUrl(filePath: string, userId: string, expiresIn: number = 60) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUrl() {
      setLoading(true);
      setError(null);

      const result = await createAuthenticatedSignedUrl(userId, filePath, expiresIn);
      
      if (result.signedUrl) {
        setSignedUrl(result.signedUrl);
      } else {
        setError(result.error || '署名付きURL取得に失敗');
      }
      
      setLoading(false);
    }

    if (filePath && userId) {
      fetchUrl();
    }
  }, [filePath, userId, expiresIn]);

  return { signedUrl, loading, error };
}

/**
 * シンプルな画像表示コンポーネント
 */
interface SimplePrivateImageProps {
  filePath: string;
  userId: string;
  expiresIn?: number;
  className?: string;
  alt?: string;
}

export function SimplePrivateImage({ 
  filePath, 
  userId, 
  expiresIn = 60,
  className = '',
  alt = 'Private Image'
}: SimplePrivateImageProps) {
  const { signedUrl, loading, error } = useSimpleSignedUrl(filePath, userId, expiresIn);

  if (loading) {
    return (
      <div className={`bg-gray-200 animate-pulse ${className}`}>
        <span className="text-gray-500">読み込み中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-100 text-red-600 p-4 ${className}`}>
        エラー: {error}
      </div>
    );
  }

  if (!signedUrl) {
    return (
      <div className={`bg-gray-100 ${className}`}>
        <span className="text-gray-500">画像が見つかりません</span>
      </div>
    );
  }

  return (
    <img 
      src={signedUrl} 
      alt={alt}
      className={className}
    />
  );
}

// 使用例:
/*
// 1. 直接使用
const result = await createSimpleSignedUrl('user123/img1.png', 60);
if (result.signedUrl) {
  console.log('URL:', result.signedUrl);
}

// 2. Reactコンポーネント
<SimplePrivateImage 
  filePath="user123/generated/image.png"
  userId="user123"
  expiresIn={60}
  className="w-64 h-64"
/>

// 3. フック使用
const { signedUrl, loading, error } = useSimpleSignedUrl(
  'user123/generated/image.png', 
  'user123', 
  60
);
*/