// HTMLエスケープ処理ライブラリ
// XSS攻撃防止のため、すべてのユーザー入力をエスケープ

/**
 * HTMLエスケープ文字の対応表
 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * HTMLアンエスケープ文字の対応表
 */
const HTML_UNESCAPE_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#x2F;': '/',
  '&#x60;': '`',
  '&#x3D;': '='
};

/**
 * 基本的なHTMLエスケープ
 * XSS攻撃を防ぐため、危険な文字をHTMLエンティティに変換
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  return text.replace(/[&<>"'`=\/]/g, (match) => HTML_ESCAPE_MAP[match] || match);
}

/**
 * HTMLアンエスケープ
 * エスケープされたHTMLエンティティを元の文字に戻す
 */
export function unescapeHtml(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  return text.replace(/&amp;|&lt;|&gt;|&quot;|&#x27;|&#x2F;|&#x60;|&#x3D;/g, (match) => 
    HTML_UNESCAPE_MAP[match] || match
  );
}

/**
 * 属性値用のエスケープ
 * HTML属性内で使用する値を安全にエスケープ
 */
export function escapeHtmlAttribute(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * JavaScript文字列用のエスケープ
 * JavaScript内の文字列リテラルで使用する値を安全にエスケープ
 */
export function escapeJavaScript(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/\v/g, '\\v')
    .replace(/\0/g, '\\0')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * React表示用の安全なHTMLエスケープ（強化版）
 * すべてのユーザー入力文字列の表示前に使用
 */
export function escapeForDisplay(text: string | null | undefined): string {
  if (text === null || text === undefined) {
    return '';
  }

  if (typeof text !== 'string') {
    text = String(text);
  }

  // 空文字列の場合はそのまま返す
  if (text === '') {
    return '';
  }

  // HTMLタグとエンティティを完全にエスケープ
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;')
    .replace(/\{/g, '&#x7B;')
    .replace(/\}/g, '&#x7D;')
    .replace(/\[/g, '&#x5B;')
    .replace(/\]/g, '&#x5D;')
    .replace(/\(/g, '&#x28;')
    .replace(/\)/g, '&#x29;');
}

/**
 * プロンプト表示用の特別なエスケープ
 * HTMLタグを除去し、改行を保持
 */
export function escapePromptForDisplay(prompt: string | null | undefined): string {
  if (!prompt) return '';

  // まず基本的なエスケープを適用
  let escaped = escapeForDisplay(prompt);
  
  // 改行文字を<br>タグに変換（安全）
  escaped = escaped.replace(/\n/g, '<br>');
  
  return escaped;
}

/**
 * ユーザー名表示用のエスケープ
 * 特殊文字を制限し、表示安全性を確保
 */
export function escapeUsernameForDisplay(username: string | null | undefined): string {
  if (!username) return 'ゲストユーザー';

  // 基本エスケープ後、長さ制限
  const escaped = escapeForDisplay(username);
  
  // 最大50文字に制限
  if (escaped.length > 50) {
    return escaped.substring(0, 47) + '...';
  }
  
  return escaped;
}

/**
 * コメント表示用のエスケープ
 * HTMLタグを除去し、改行と基本的な書式を保持
 */
export function escapeCommentForDisplay(comment: string | null | undefined): string {
  if (!comment) return '';

  // 基本エスケープ
  let escaped = escapeForDisplay(comment);
  
  // 改行を保持
  escaped = escaped.replace(/\n/g, '<br>');
  
  // 長すぎるコメントは省略
  if (escaped.length > 500) {
    return escaped.substring(0, 497) + '...';
  }
  
  return escaped;
}

/**
 * エラーメッセージ表示用のエスケープ
 * システムメッセージの安全な表示
 */
export function escapeErrorForDisplay(error: string | null | undefined): string {
  if (!error) return 'エラーが発生しました';

  // エラーメッセージは完全にエスケープ
  const escaped = escapeForDisplay(error);
  
  // エラーメッセージの長さ制限
  if (escaped.length > 200) {
    return escaped.substring(0, 197) + '...';
  }
  
  return escaped;
}

/**
 * 配列の各要素を安全にエスケープ
 */
export function escapeArrayForDisplay(items: (string | null | undefined)[]): string[] {
  return items
    .filter(item => item !== null && item !== undefined)
    .map(item => escapeForDisplay(item));
}

/**
 * オブジェクトのすべての文字列値を安全にエスケープ
 */
export function escapeObjectForDisplay<T extends Record<string, any>>(obj: T): T {
  const escaped = { ...obj };
  
  for (const key in escaped) {
    const value = escaped[key];
    if (typeof value === 'string') {
      escaped[key] = escapeForDisplay(value);
    } else if (Array.isArray(value)) {
      escaped[key] = escapeArrayForDisplay(value);
    } else if (value && typeof value === 'object') {
      escaped[key] = escapeObjectForDisplay(value);
    }
  }
  
  return escaped;
}

/**
 * 検索クエリ表示用のエスケープ
 * 検索語をハイライト表示する際の安全性確保
 */
export function escapeSearchQueryForDisplay(query: string | null | undefined): string {
  if (!query) return '';

  // 検索クエリは特に厳格にエスケープ
  const escaped = escapeForDisplay(query);
  
  // 検索クエリの長さ制限
  if (escaped.length > 100) {
    return escaped.substring(0, 97) + '...';
  }
  
  return escaped;
}

/**
 * CSS値用のエスケープ
 * CSS内で使用する値を安全にエスケープ
 */
export function escapeCss(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  return text.replace(/[^\w-]/g, (match) => {
    const charCode = match.charCodeAt(0);
    return `\\${charCode.toString(16).padStart(6, '0')} `;
  });
}

/**
 * URL用のエスケープ
 * URL内で使用する値を安全にエスケープ
 */
export function escapeUrl(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  try {
    return encodeURIComponent(text);
  } catch (error) {
    // エンコードに失敗した場合は空文字を返す
    console.warn('URL encoding failed:', error);
    return '';
  }
}

/**
 * 複数行テキスト用のエスケープ
 * 改行を保持しつつHTMLエスケープを行う
 */
export function escapeMultilineText(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  return escapeHtml(text)
    .replace(/\n/g, '<br>')
    .replace(/\r\n/g, '<br>')
    .replace(/\r/g, '<br>');
}

/**
 * ファイル名用のエスケープ
 * ファイル名として安全でない文字を除去または置換
 */
export function escapeFileName(fileName: string): string {
  if (typeof fileName !== 'string') {
    return String(fileName);
  }

  return fileName
    // 危険な文字を除去
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    // 連続するドットを単一のドットに
    .replace(/\.{2,}/g, '.')
    // 先頭・末尾のドットとスペースを除去
    .replace(/^[\s.]+|[\s.]+$/g, '')
    // 空文字の場合はデフォルト名を設定
    || 'untitled';
}

/**
 * 安全な文字列かどうかをチェック
 * 危険な文字が含まれていないかを確認
 */
export function isSafeString(text: string): boolean {
  if (typeof text !== 'string') {
    return false;
  }

  // スクリプトタグの検出
  if (/<script[\s\S]*?>[\s\S]*?<\/script>/gi.test(text)) {
    return false;
  }

  // イベントハンドラーの検出
  if (/\bon\w+\s*=/gi.test(text)) {
    return false;
  }

  // javascript: プロトコルの検出
  if (/javascript:/gi.test(text)) {
    return false;
  }

  // data: URLs with script content
  if (/data:.*script/gi.test(text)) {
    return false;
  }

  return true;
}

/**
 * テキストを安全に切り詰める
 * 指定された長さで切り詰め、HTMLエスケープも行う
 */
export function truncateAndEscape(text: string, maxLength: number = 100): string {
  if (typeof text !== 'string') {
    text = String(text);
  }

  if (text.length <= maxLength) {
    return escapeHtml(text);
  }

  return escapeHtml(text.substring(0, maxLength - 3)) + '...';
}

/**
 * オブジェクトの全ての文字列プロパティをエスケープ
 * ネストしたオブジェクトも再帰的に処理
 */
export function escapeObjectStrings<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return escapeHtml(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => escapeObjectStrings(item)) as T;
  }

  if (typeof obj === 'object') {
    const escapedObj = {} as T;
    for (const [key, value] of Object.entries(obj)) {
      (escapedObj as any)[key] = escapeObjectStrings(value);
    }
    return escapedObj;
  }

  return obj;
}

/**
 * React用のセーフな文字列変換
 * dangerouslySetInnerHTMLで使用する前の安全化
 */
export function sanitizeForDangerouslySetInnerHTML(text: string): { __html: string } {
  if (typeof text !== 'string') {
    text = String(text);
  }

  // 基本的なHTMLエスケープ
  const escaped = escapeHtml(text);

  // 改行をbrタグに変換
  const withBreaks = escaped.replace(/\n/g, '<br>');

  return { __html: withBreaks };
}

/**
 * プロンプト文字列の安全化
 * AI画像生成のプロンプトに使用する文字列を安全化
 */
export function sanitizePrompt(prompt: string): string {
  if (typeof prompt !== 'string') {
    return '';
  }

  return prompt
    // HTMLタグを除去
    .replace(/<[^>]*>/g, '')
    // 危険な文字をエスケープ
    .replace(/[<>&"']/g, (match) => HTML_ESCAPE_MAP[match] || match)
    // 連続する空白を単一スペースに
    .replace(/\s+/g, ' ')
    // 先頭・末尾の空白を除去
    .trim()
    // 最大長制限
    .substring(0, 1000);
}

/**
 * バリデーション用の安全チェック
 * フォーム入力値の基本的な安全性をチェック
 */
export function validateUserInput(input: string, options?: {
  maxLength?: number;
  allowHtml?: boolean;
  allowNewlines?: boolean;
}): {
  isValid: boolean;
  errors: string[];
  sanitized: string;
} {
  const { maxLength = 1000, allowHtml = false, allowNewlines = true } = options || {};
  const errors: string[] = [];

  if (typeof input !== 'string') {
    return {
      isValid: false,
      errors: ['入力値が文字列ではありません'],
      sanitized: ''
    };
  }

  // 長さチェック
  if (input.length > maxLength) {
    errors.push(`入力値が長すぎます（最大${maxLength}文字）`);
  }

  // HTMLタグのチェック
  if (!allowHtml && /<[^>]*>/g.test(input)) {
    errors.push('HTMLタグは使用できません');
  }

  // 改行のチェック
  if (!allowNewlines && /[\r\n]/g.test(input)) {
    errors.push('改行は使用できません');
  }

  // 危険なスクリプトのチェック
  if (!isSafeString(input)) {
    errors.push('危険な文字列が含まれています');
  }

  // サニタイズ処理
  let sanitized = input;
  if (!allowHtml) {
    sanitized = escapeHtml(sanitized);
  }
  if (!allowNewlines) {
    sanitized = sanitized.replace(/[\r\n]/g, ' ');
  }
  sanitized = sanitized.substring(0, maxLength);

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * 一括サニタイズ関数（すべてのテキスト入力用）
 */
export function sanitizeAllTextInputs(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // キーに応じて適切なサニタイズ関数を選択
      switch (key.toLowerCase()) {
        case 'prompt':
          sanitized[key] = sanitizePrompt(value);
          break;
        case 'name':
        case 'title':
        case 'templatename':
        case 'template_name':
          sanitized[key] = escapeHtml(value).substring(0, 100);
          break;
        case 'username':
        case 'user_name':
        case 'fullname':
        case 'full_name':
          sanitized[key] = escapeHtml(value).substring(0, 50);
          break;
        case 'comment':
        case 'message':
          sanitized[key] = escapeHtml(value).substring(0, 500);
          break;
        case 'tag':
        case 'tags':
          if (Array.isArray(value)) {
            sanitized[key] = value.map(tag => escapeHtml(String(tag)).substring(0, 30));
          } else {
            sanitized[key] = escapeHtml(String(value)).substring(0, 30);
          }
          break;
        case 'description':
        case 'desc':
          sanitized[key] = escapeHtml(value).substring(0, 1000);
          break;
        case 'filename':
        case 'file_name':
          sanitized[key] = escapeFileName(value);
          break;
        case 'style':
        case 'background':
        case 'resolution':
          sanitized[key] = escapeHtml(value).substring(0, 50);
          break;
        default:
          // デフォルトは基本的なHTMLエスケープ
          sanitized[key] = escapeHtml(value);
      }
    } else if (Array.isArray(value)) {
      // 配列の場合は再帰的に処理
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? escapeHtml(item) : 
        typeof item === 'object' && item !== null ? sanitizeAllTextInputs(item) : item
      );
    } else if (value && typeof value === 'object') {
      // オブジェクトの場合は再帰的に処理
      sanitized[key] = sanitizeAllTextInputs(value);
    } else {
      // その他（数値、boolean等）はそのまま
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}