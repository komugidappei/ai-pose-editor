// 画像アップロード用のセキュリティ強化ライブラリ
// 画像の検証、再エンコード、サイズ調整を行う

import sharp from 'sharp';
import mime from 'mime-types';

// 許可される画像形式
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg'];

// 画像設定
const MAX_WIDTH = 512;
const MAX_HEIGHT = 512;
const QUALITY = 85; // JPEG品質

// エラー型定義
export interface ImageValidationError {
  type: 'validation' | 'processing' | 'size';
  message: string;
  details?: any;
}

// 処理結果型定義
export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  originalSize: number;
  processedSize: number;
  filename: string;
}

/**
 * ファイル拡張子を取得
 */
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * MIMEタイプから適切な拡張子を取得
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png'
  };
  return mimeToExt[mimeType] || '';
}

/**
 * ファイルの基本検証
 */
function validateFile(file: File): ImageValidationError | null {
  // MIMEタイプの検証
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      type: 'validation',
      message: `対応していない画像形式です。PNG、JPEG、JPGファイルのみ対応しています。（受信: ${file.type}）`,
      details: { receivedMimeType: file.type, allowedTypes: ALLOWED_MIME_TYPES }
    };
  }

  // ファイル拡張子の検証
  const extension = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      type: 'validation',
      message: `対応していない拡張子です。.png、.jpg、.jpeg ファイルのみ対応しています。（受信: .${extension}）`,
      details: { receivedExtension: extension, allowedExtensions: ALLOWED_EXTENSIONS }
    };
  }

  // MIMEタイプと拡張子の整合性チェック
  const expectedMimeType = lookup(file.name);
  if (expectedMimeType && !ALLOWED_MIME_TYPES.includes(expectedMimeType)) {
    return {
      type: 'validation',
      message: 'ファイル拡張子とMIMEタイプが一致しません。',
      details: { 
        fileName: file.name,
        receivedMimeType: file.type, 
        expectedMimeType 
      }
    };
  }

  // ファイルサイズの検証（10MB制限）
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      type: 'size',
      message: `ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。（現在: ${(file.size / 1024 / 1024).toFixed(2)}MB）`,
      details: { fileSize: file.size, maxSize }
    };
  }

  return null;
}

/**
 * シンプルな画像サニタイズ（提供されたコードベース）
 */
export async function sanitizeImage(file: File): Promise<Buffer> {
  const mimeType = file.type;
  const ext = mime.extension(mimeType);

  if (!ext || !['png', 'jpg', 'jpeg'].includes(ext)) {
    throw new Error('不正な画像形式です');
  }

  const buffer = await file.arrayBuffer();
  const cleaned = await sharp(Buffer.from(buffer))
    .resize(512, 512, { fit: 'inside' })
    .toFormat('png')
    .toBuffer();

  return cleaned;
}

/**
 * 詳細な画像サニタイズと再エンコード（既存の高機能版）
 */
export async function sanitizeImageDetailed(file: File): Promise<ProcessedImage> {
  try {
    // 1. 基本検証
    const validationError = validateFile(file);
    if (validationError) {
      throw new Error(validationError.message);
    }

    // 2. ファイルをBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const originalSize = inputBuffer.length;

    // 3. 画像の詳細情報を取得
    const metadata = await sharp(inputBuffer).metadata();
    
    // 4. 画像形式の再検証（メタデータベース）
    if (!metadata.format || !['jpeg', 'jpg', 'png'].includes(metadata.format)) {
      throw new Error(`サポートされていない画像形式です: ${metadata.format}`);
    }

    // 5. 悪意のあるメタデータをチェック
    if (metadata.density && metadata.density > 1000) {
      console.warn('異常に高いDPI値を検出:', metadata.density);
    }

    // 6. 画像を再エンコード（セキュリティ強化）
    let sharpInstance = sharp(inputBuffer)
      .resize(MAX_WIDTH, MAX_HEIGHT, { 
        fit: 'inside', // アスペクト比を維持
        withoutEnlargement: true // 元画像より大きくしない
      })
      .removeAlpha(false) // アルファチャンネルを保持
      .rotate() // EXIF情報に基づく自動回転
      // EXIFデータとその他のメタデータを削除
      .withMetadata({
        exif: {},
        icc: undefined,
        iptc: undefined,
        xmp: undefined
      });

    // 7. 出力形式の決定と最適化
    let outputBuffer: Buffer;
    let outputMimeType: string;
    let outputExtension: string;

    if (file.type === 'image/png') {
      // PNGとして出力（透明度対応）
      outputBuffer = await sharpInstance
        .png({ 
          compressionLevel: 6, // 圧縮レベル（0-9）
          progressive: false,
          force: true
        })
        .toBuffer();
      outputMimeType = 'image/png';
      outputExtension = 'png';
    } else {
      // JPEGとして出力
      outputBuffer = await sharpInstance
        .jpeg({ 
          quality: QUALITY, // 品質設定
          progressive: true,
          mozjpeg: true, // より良い圧縮
          force: true
        })
        .toBuffer();
      outputMimeType = 'image/jpeg';
      outputExtension = 'jpg';
    }

    // 8. 処理後の画像情報を取得
    const processedMetadata = await sharp(outputBuffer).metadata();

    // 9. 安全なファイル名を生成
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const safeFilename = `processed_${timestamp}_${randomSuffix}.${outputExtension}`;

    // 10. 結果を返す
    return {
      buffer: outputBuffer,
      mimeType: outputMimeType,
      width: processedMetadata.width || 0,
      height: processedMetadata.height || 0,
      originalSize,
      processedSize: outputBuffer.length,
      filename: safeFilename
    };

  } catch (error) {
    console.error('画像処理エラー:', error);
    
    if (error instanceof Error) {
      throw new Error(`画像の処理に失敗しました: ${error.message}`);
    } else {
      throw new Error('画像の処理中に予期しないエラーが発生しました');
    }
  }
}

/**
 * 画像処理の統計情報を取得
 */
export function getProcessingStats(processed: ProcessedImage): {
  compressionRatio: number;
  sizeBefore: string;
  sizeAfter: string;
  savedBytes: number;
  savedPercentage: number;
} {
  const compressionRatio = processed.originalSize / processed.processedSize;
  const savedBytes = processed.originalSize - processed.processedSize;
  const savedPercentage = (savedBytes / processed.originalSize) * 100;

  return {
    compressionRatio: Math.round(compressionRatio * 100) / 100,
    sizeBefore: formatBytes(processed.originalSize),
    sizeAfter: formatBytes(processed.processedSize),
    savedBytes,
    savedPercentage: Math.round(savedPercentage * 100) / 100
  };
}

/**
 * バイト数を人間が読みやすい形式に変換
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 画像のContent-Typeを検証
 */
export function validateImageContentType(contentType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(contentType);
}

/**
 * Base64画像データを処理
 */
export async function sanitizeBase64Image(base64Data: string): Promise<ProcessedImage> {
  try {
    // Data URLからMIMEタイプとデータを抽出
    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('無効なBase64画像データです');
    }

    const mimeType = matches[1];
    const base64Content = matches[2];

    // MIMEタイプの検証
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error(`対応していない画像形式です: ${mimeType}`);
    }

    // Base64をBufferに変換
    const buffer = Buffer.from(base64Content, 'base64');

    // 仮想Fileオブジェクトを作成して既存の処理を流用
    const extension = getExtensionFromMimeType(mimeType);
    const virtualFile = new File([buffer], `upload.${extension}`, { type: mimeType });

    return await sanitizeImage(virtualFile);

  } catch (error) {
    console.error('Base64画像処理エラー:', error);
    throw new Error(`Base64画像の処理に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
  }
}

/**
 * 複数画像の一括処理
 */
export async function sanitizeMultipleImages(files: File[]): Promise<{
  successful: ProcessedImage[];
  failed: Array<{ file: File; error: string }>;
}> {
  const successful: ProcessedImage[] = [];
  const failed: Array<{ file: File; error: string }> = [];

  for (const file of files) {
    try {
      const processed = await sanitizeImage(file);
      successful.push(processed);
    } catch (error) {
      failed.push({
        file,
        error: error instanceof Error ? error.message : '不明なエラー'
      });
    }
  }

  return { successful, failed };
}