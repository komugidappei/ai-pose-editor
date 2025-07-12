'use client';

// 安全なテキスト表示コンポーネント
// すべてのユーザー入力文字列をHTMLエスケープして表示

import React from 'react';
import { 
  escapeForDisplay, 
  escapePromptForDisplay, 
  escapeUsernameForDisplay,
  escapeCommentForDisplay,
  escapeErrorForDisplay 
} from '@/lib/htmlEscape';

interface SafeTextProps {
  children: string | null | undefined;
  className?: string;
  type?: 'default' | 'prompt' | 'username' | 'comment' | 'error';
  maxLength?: number;
  allowLineBreaks?: boolean;
  fallback?: string;
}

/**
 * 安全なテキスト表示コンポーネント
 * すべてのユーザー入力をHTMLエスケープして表示
 */
export default function SafeText({ 
  children, 
  className = '', 
  type = 'default',
  maxLength,
  allowLineBreaks = false,
  fallback = ''
}: SafeTextProps) {
  // null/undefinedの場合はfallbackを表示
  if (children === null || children === undefined) {
    return <span className={className}>{fallback}</span>;
  }

  // 文字列に変換
  const text = String(children);

  // 空文字列の場合はfallbackを表示
  if (text === '') {
    return <span className={className}>{fallback}</span>;
  }

  // タイプ別のエスケープ処理
  let escapedText: string;
  switch (type) {
    case 'prompt':
      escapedText = escapePromptForDisplay(text);
      break;
    case 'username':
      escapedText = escapeUsernameForDisplay(text);
      break;
    case 'comment':
      escapedText = escapeCommentForDisplay(text);
      break;
    case 'error':
      escapedText = escapeErrorForDisplay(text);
      break;
    default:
      escapedText = escapeForDisplay(text);
  }

  // 最大長制限の適用
  if (maxLength && escapedText.length > maxLength) {
    escapedText = escapedText.substring(0, maxLength - 3) + '...';
  }

  // 改行許可の場合は、改行で分割して複数の要素として表示（dangerouslySetInnerHTMLの安全な代替）
  if (allowLineBreaks && (type === 'prompt' || type === 'comment')) {
    // エスケープ済みテキストから<br>タグを除去し、改行で分割
    const textWithoutBrTags = escapedText.replace(/<br>/g, '\n');
    const lines = textWithoutBrTags.split('\n');
    
    return (
      <span className={className}>
        {lines.map((line, index) => (
          <React.Fragment key={index}>
            {line}
            {index < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </span>
    );
  }

  // 通常のテキスト表示（推奨）
  return <span className={className}>{escapedText}</span>;
}

/**
 * プロンプト専用の安全表示コンポーネント
 */
export function SafePrompt({ 
  children, 
  className = '',
  maxLength = 200,
  allowLineBreaks = true 
}: Omit<SafeTextProps, 'type'>) {
  return (
    <SafeText 
      type="prompt" 
      className={className}
      maxLength={maxLength}
      allowLineBreaks={allowLineBreaks}
      fallback="プロンプトが設定されていません"
    >
      {children}
    </SafeText>
  );
}

/**
 * ユーザー名専用の安全表示コンポーネント
 */
export function SafeUsername({ 
  children, 
  className = '',
  maxLength = 50 
}: Omit<SafeTextProps, 'type' | 'allowLineBreaks'>) {
  return (
    <SafeText 
      type="username" 
      className={className}
      maxLength={maxLength}
      fallback="ゲストユーザー"
    >
      {children}
    </SafeText>
  );
}

/**
 * コメント専用の安全表示コンポーネント
 */
export function SafeComment({ 
  children, 
  className = '',
  maxLength = 500,
  allowLineBreaks = true 
}: Omit<SafeTextProps, 'type'>) {
  return (
    <SafeText 
      type="comment" 
      className={className}
      maxLength={maxLength}
      allowLineBreaks={allowLineBreaks}
      fallback="コメントはありません"
    >
      {children}
    </SafeText>
  );
}

/**
 * エラーメッセージ専用の安全表示コンポーネント
 */
export function SafeError({ 
  children, 
  className = 'text-red-600',
  maxLength = 200 
}: Omit<SafeTextProps, 'type' | 'allowLineBreaks'>) {
  return (
    <SafeText 
      type="error" 
      className={className}
      maxLength={maxLength}
      fallback="エラーが発生しました"
    >
      {children}
    </SafeText>
  );
}

/**
 * 複数行テキスト用の安全表示コンポーネント
 */
export function SafeMultilineText({ 
  children, 
  className = '',
  maxLength = 1000 
}: {
  children: string | null | undefined;
  className?: string;
  maxLength?: number;
}) {
  return (
    <SafeText 
      type="default" 
      className={className}
      maxLength={maxLength}
      allowLineBreaks={true}
      fallback=""
    >
      {children}
    </SafeText>
  );
}

/**
 * 配列を安全に表示するコンポーネント
 */
export function SafeArrayDisplay({ 
  items, 
  separator = ', ',
  className = '',
  maxItems = 10 
}: {
  items: (string | null | undefined)[];
  separator?: string;
  className?: string;
  maxItems?: number;
}) {
  if (!items || items.length === 0) {
    return <span className={className}>なし</span>;
  }

  // null/undefinedを除外
  const filteredItems = items
    .filter(item => item !== null && item !== undefined && item !== '')
    .slice(0, maxItems);

  if (filteredItems.length === 0) {
    return <span className={className}>なし</span>;
  }

  return (
    <span className={className}>
      {filteredItems.map((item, index) => (
        <React.Fragment key={index}>
          <SafeText>{item}</SafeText>
          {index < filteredItems.length - 1 && separator}
        </React.Fragment>
      ))}
      {items.length > maxItems && ` ... 他${items.length - maxItems}項目`}
    </span>
  );
}

/**
 * 検索クエリ用の安全表示コンポーネント
 * ハイライト機能付き
 */
export function SafeSearchHighlight({ 
  text, 
  query, 
  className = '',
  highlightClassName = 'bg-yellow-200 font-semibold' 
}: {
  text: string | null | undefined;
  query: string | null | undefined;
  className?: string;
  highlightClassName?: string;
}) {
  if (!text || !query) {
    return <SafeText className={className}>{text}</SafeText>;
  }

  // テキストとクエリを安全にエスケープ
  const escapedText = escapeForDisplay(text);
  const escapedQuery = escapeForDisplay(query);

  // クエリが空の場合は通常表示
  if (escapedQuery === '') {
    return <span className={className}>{escapedText}</span>;
  }

  // 大文字小文字を区別しない検索
  const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = escapedText.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) => 
        regex.test(part) ? (
          <span key={index} className={highlightClassName}>{part}</span>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
}

/**
 * JSON データの安全表示コンポーネント
 */
export function SafeJsonDisplay({ 
  data, 
  className = 'font-mono text-sm',
  maxDepth = 3 
}: {
  data: any;
  className?: string;
  maxDepth?: number;
}) {
  if (data === null || data === undefined) {
    return <span className={className}>null</span>;
  }

  try {
    // JSONを文字列化して安全にエスケープ
    const jsonString = JSON.stringify(data, null, 2);
    const escapedJson = escapeForDisplay(jsonString);

    return (
      <pre className={className}>
        {escapedJson.length > 1000 
          ? escapedJson.substring(0, 997) + '...'
          : escapedJson
        }
      </pre>
    );
  } catch (error) {
    return (
      <SafeError className={className}>
        JSON表示エラー: {error instanceof Error ? error.message : '不明なエラー'}
      </SafeError>
    );
  }
}