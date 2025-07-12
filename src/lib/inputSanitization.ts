// 入力サニタイズミドルウェア
// すべてのAPI入力を自動的にサニタイズ

import { NextRequest } from 'next/server';
import { sanitizeAllTextInputs, validateUserInput } from './htmlEscape';

/**
 * リクエストボディのサニタイズ
 */
export async function sanitizeRequestBody(request: NextRequest): Promise<{
  sanitized: any;
  originalSize: number;
  sanitizedSize: number;
  warnings: string[];
}> {
  const warnings: string[] = [];
  let body: any = {};

  try {
    // Content-Typeに応じて処理を分岐
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      // JSON形式の場合
      const text = await request.text();
      const originalSize = text.length;
      
      if (originalSize > 10 * 1024 * 1024) { // 10MB制限
        warnings.push('リクエストサイズが大きすぎます');
        return { sanitized: {}, originalSize, sanitizedSize: 0, warnings };
      }

      body = JSON.parse(text);
      
    } else if (contentType.includes('multipart/form-data')) {
      // FormData の場合
      const formData = await request.formData();
      body = {};
      
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          // ファイルはそのまま（別途処理）
          body[key] = value;
        } else {
          body[key] = value;
        }
      }
      
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // URL encoded form の場合
      const text = await request.text();
      const urlParams = new URLSearchParams(text);
      body = Object.fromEntries(urlParams.entries());
    }

    // サニタイズ実行
    const sanitized = sanitizeAllTextInputs(body);
    const sanitizedSize = JSON.stringify(sanitized).length;
    const originalSize = JSON.stringify(body).length;

    // サイズ変化をチェック
    if (sanitizedSize < originalSize) {
      warnings.push('入力データがサニタイズされました');
    }

    return {
      sanitized,
      originalSize,
      sanitizedSize,
      warnings
    };

  } catch (error) {
    console.error('Input sanitization error:', error);
    return {
      sanitized: {},
      originalSize: 0,
      sanitizedSize: 0,
      warnings: ['入力データの解析に失敗しました']
    };
  }
}

/**
 * クエリパラメータのサニタイズ
 */
export function sanitizeQueryParams(request: NextRequest): {
  sanitized: Record<string, string>;
  warnings: string[];
} {
  const warnings: string[] = [];
  const sanitized: Record<string, string> = {};

  try {
    const { searchParams } = request.nextUrl;

    for (const [key, value] of searchParams.entries()) {
      // キーのサニタイズ
      const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
      if (cleanKey !== key) {
        warnings.push(`クエリパラメータキー "${key}" がサニタイズされました`);
      }

      // 値のバリデーションとサニタイズ
      const validation = validateUserInput(value, {
        maxLength: 500,
        allowHtml: false,
        allowNewlines: false
      });

      if (!validation.isValid) {
        warnings.push(`クエリパラメータ "${cleanKey}" に問題があります: ${validation.errors.join(', ')}`);
      }

      sanitized[cleanKey] = validation.sanitized;
    }

    return { sanitized, warnings };

  } catch (error) {
    console.error('Query params sanitization error:', error);
    return {
      sanitized: {},
      warnings: ['クエリパラメータの処理に失敗しました']
    };
  }
}

/**
 * ヘッダーのサニタイズ（ユーザー入力部分のみ）
 */
export function sanitizeHeaders(request: NextRequest): {
  sanitized: Record<string, string>;
  warnings: string[];
} {
  const warnings: string[] = [];
  const sanitized: Record<string, string> = {};

  // サニタイズ対象のヘッダー（ユーザーが設定可能なもの）
  const userHeaders = [
    'x-user-id',
    'x-session-id',
    'x-request-id',
    'x-client-version',
    'x-custom-header'
  ];

  try {
    userHeaders.forEach(headerName => {
      const value = request.headers.get(headerName);
      if (value) {
        const validation = validateUserInput(value, {
          maxLength: 100,
          allowHtml: false,
          allowNewlines: false
        });

        if (!validation.isValid) {
          warnings.push(`ヘッダー "${headerName}" に問題があります: ${validation.errors.join(', ')}`);
        }

        sanitized[headerName] = validation.sanitized;
      }
    });

    return { sanitized, warnings };

  } catch (error) {
    console.error('Headers sanitization error:', error);
    return {
      sanitized: {},
      warnings: ['ヘッダーの処理に失敗しました']
    };
  }
}

/**
 * 包括的な入力サニタイズ
 */
export async function sanitizeAllInputs(request: NextRequest): Promise<{
  body: any;
  query: Record<string, string>;
  headers: Record<string, string>;
  warnings: string[];
  stats: {
    originalBodySize: number;
    sanitizedBodySize: number;
    queryParamCount: number;
    headerCount: number;
  };
}> {
  const allWarnings: string[] = [];

  // ボディのサニタイズ
  const bodyResult = await sanitizeRequestBody(request);
  allWarnings.push(...bodyResult.warnings);

  // クエリパラメータのサニタイズ
  const queryResult = sanitizeQueryParams(request);
  allWarnings.push(...queryResult.warnings);

  // ヘッダーのサニタイズ
  const headerResult = sanitizeHeaders(request);
  allWarnings.push(...headerResult.warnings);

  return {
    body: bodyResult.sanitized,
    query: queryResult.sanitized,
    headers: headerResult.sanitized,
    warnings: allWarnings,
    stats: {
      originalBodySize: bodyResult.originalSize,
      sanitizedBodySize: bodyResult.sanitizedSize,
      queryParamCount: Object.keys(queryResult.sanitized).length,
      headerCount: Object.keys(headerResult.sanitized).length
    }
  };
}

/**
 * 特定フィールドの厳密なバリデーション
 */
export function validateSpecificFields(data: Record<string, any>): {
  isValid: boolean;
  errors: Record<string, string[]>;
  sanitized: Record<string, any>;
} {
  const errors: Record<string, string[]> = {};
  const sanitized: Record<string, any> = {};

  // プロンプトの検証
  if (data.prompt) {
    const validation = validateUserInput(data.prompt, {
      maxLength: 2000,
      allowHtml: false,
      allowNewlines: true
    });
    
    if (!validation.isValid) {
      errors.prompt = validation.errors;
    }
    sanitized.prompt = validation.sanitized;
  }

  // メールアドレスの検証
  if (data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.email = ['有効なメールアドレスを入力してください'];
    }
    sanitized.email = data.email.toLowerCase().trim();
  }

  // URLの検証
  if (data.url || data.redirect_url) {
    const urlField = data.url || data.redirect_url;
    try {
      const url = new URL(urlField);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.url = ['HTTPまたはHTTPSのURLのみ許可されています'];
      }
      sanitized.url = url.toString();
    } catch {
      errors.url = ['有効なURLを入力してください'];
    }
  }

  // ファイルサイズの検証
  if (data.file_size && typeof data.file_size === 'number') {
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (data.file_size > maxSize) {
      errors.file_size = ['ファイルサイズが大きすぎます'];
    }
    sanitized.file_size = data.file_size;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: { ...data, ...sanitized }
  };
}

/**
 * セキュリティログの記録
 */
export function logSecurityEvent(event: {
  type: 'sanitization' | 'validation_error' | 'suspicious_input';
  details: string;
  userAgent?: string;
  ip?: string;
  endpoint?: string;
}) {
  // 本番環境ではセキュリティログシステムに送信
  console.log(`[SECURITY] ${event.type}: ${event.details}`, {
    timestamp: new Date().toISOString(),
    userAgent: event.userAgent,
    ip: event.ip,
    endpoint: event.endpoint
  });
}