import { NextRequest, NextResponse } from 'next/server';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { rateLimit, rateLimitPresets } from '@/lib/rateLimit';

// ポーズキーポイントの型定義
interface Keypoint {
  name: string;
  x: number;
  y: number;
  confidence?: number;
}

interface PoseResponse {
  success: boolean;
  keypoints?: Keypoint[];
  message?: string;
  processingTime?: number;
}

// モックポーズデータ（正規化済み座標 0.0-1.0）
const MOCK_POSE_DATA: Keypoint[] = [
  // 頭部・首
  { name: "nose", x: 0.5, y: 0.15, confidence: 0.95 },
  { name: "left_eye", x: 0.48, y: 0.12, confidence: 0.92 },
  { name: "right_eye", x: 0.52, y: 0.12, confidence: 0.93 },
  { name: "left_ear", x: 0.45, y: 0.13, confidence: 0.88 },
  { name: "right_ear", x: 0.55, y: 0.13, confidence: 0.89 },
  
  // 肩
  { name: "left_shoulder", x: 0.4, y: 0.25, confidence: 0.96 },
  { name: "right_shoulder", x: 0.6, y: 0.25, confidence: 0.97 },
  
  // ひじ
  { name: "left_elbow", x: 0.35, y: 0.35, confidence: 0.91 },
  { name: "right_elbow", x: 0.65, y: 0.35, confidence: 0.92 },
  
  // 手首
  { name: "left_wrist", x: 0.32, y: 0.45, confidence: 0.87 },
  { name: "right_wrist", x: 0.68, y: 0.45, confidence: 0.89 },
  
  // 腰
  { name: "left_hip", x: 0.45, y: 0.55, confidence: 0.94 },
  { name: "right_hip", x: 0.55, y: 0.55, confidence: 0.95 },
  
  // ひざ
  { name: "left_knee", x: 0.43, y: 0.75, confidence: 0.93 },
  { name: "right_knee", x: 0.57, y: 0.75, confidence: 0.94 },
  
  // 足首
  { name: "left_ankle", x: 0.41, y: 0.95, confidence: 0.90 },
  { name: "right_ankle", x: 0.59, y: 0.95, confidence: 0.91 }
];

// バリエーション用のランダムポーズデータ
const POSE_VARIATIONS = [
  // 基本姿勢
  MOCK_POSE_DATA,
  
  // 片手を上げたポーズ
  [
    ...MOCK_POSE_DATA.slice(0, 7),
    { name: "left_elbow", x: 0.3, y: 0.2, confidence: 0.91 },
    { name: "right_elbow", x: 0.65, y: 0.35, confidence: 0.92 },
    { name: "left_wrist", x: 0.25, y: 0.1, confidence: 0.87 },
    { name: "right_wrist", x: 0.68, y: 0.45, confidence: 0.89 },
    ...MOCK_POSE_DATA.slice(11)
  ],
  
  // 片足を上げたポーズ
  [
    ...MOCK_POSE_DATA.slice(0, 13),
    { name: "left_knee", x: 0.4, y: 0.6, confidence: 0.93 },
    { name: "right_knee", x: 0.57, y: 0.75, confidence: 0.94 },
    { name: "left_ankle", x: 0.38, y: 0.5, confidence: 0.90 },
    { name: "right_ankle", x: 0.59, y: 0.95, confidence: 0.91 }
  ]
];

// FormDataを解析するヘルパー関数
function parseForm(req: NextRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      filter: ({ name, originalFilename, mimetype }) => {
        // 画像ファイルのみ許可
        return mimetype?.startsWith('image/') || false;
      }
    });

    // リクエストをNode.jsのIncomingMessage形式に変換
    const nodeReq = {
      ...req,
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
    } as any;

    form.parse(nodeReq, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

// ランダムなポーズバリエーションを生成
function generateRandomPose(): Keypoint[] {
  const baseVariation = POSE_VARIATIONS[Math.floor(Math.random() * POSE_VARIATIONS.length)];
  
  // 小さなランダム変動を追加
  return baseVariation.map(point => ({
    ...point,
    x: Math.max(0, Math.min(1, point.x + (Math.random() - 0.5) * 0.1)),
    y: Math.max(0, Math.min(1, point.y + (Math.random() - 0.5) * 0.1)),
    confidence: Math.max(0.7, Math.min(1, point.confidence + (Math.random() - 0.5) * 0.2))
  }));
}

// 簡単な画像検証
function validateImageFile(file: any): boolean {
  if (!file) return false;
  
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  return validTypes.includes(file.mimetype) && file.size <= maxSize;
}

// レート制限設定
const limiter = rateLimit(rateLimitPresets.upload);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. レート制限チェック
    const rateLimitResult = await limiter(request);
    if (!rateLimitResult.success && rateLimitResult.response) {
      return rateLimitResult.response;
    }
    // 2. TODO: 使用制限チェック
    // const userId = request.headers.get('x-user-id');
    // if (userId) {
    //   const limitCheck = await checkUsageLimit(userId, 'pose_extraction_count');
    //   if (!limitCheck.canUse) {
    //     return NextResponse.json(
    //       { success: false, message: `ポーズ抽出の1日制限（${limitCheck.limit}回）に達しました` },
    //       { status: 429 }
    //     );
    //   }
    // }

    // 3. Content-Typeをチェック
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, message: 'Content-Type must be multipart/form-data' },
        { status: 400 }
      );
    }

    // FormDataを解析
    const formData = await request.formData();
    const file = formData.get('image') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, message: '画像ファイルがありません' },
        { status: 400 }
      );
    }

    // ファイルタイプとサイズのバリデーション
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'サポートされていないファイル形式です。JPEG, PNG, WebPのみ対応しています。' },
        { status: 400 }
      );
    }
    
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, message: 'ファイルサイズが大きすぎます。10MB以下のファイルをアップロードしてください。' },
        { status: 400 }
      );
    }

    // モック処理：実際のポーズ検出ではここでMediaPipeや他のAIモデルを使用
    console.log(`Processing image: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
    
    // 処理時間をシミュレート（500ms-2000ms）
    const processingDelay = 500 + Math.random() * 1500;
    await new Promise(resolve => setTimeout(resolve, processingDelay));
    
    // ランダムなポーズデータを生成
    const poseData = generateRandomPose();
    const processingTime = Date.now() - startTime;

    // TODO: 使用回数をインクリメント
    // if (userId) {
    //   await incrementUsage(userId, 'pose_extraction_count');
    // }
    
    const response: PoseResponse = {
      success: true,
      keypoints: poseData,
      processingTime: processingTime,
      message: 'ポーズ検出が成功しました'
    };
    
    const finalResponse = NextResponse.json(response);
    
    // レート制限ヘッダーを追加
    if (rateLimitResult.remaining !== undefined) {
      finalResponse.headers.set('X-RateLimit-Limit', '3');
      finalResponse.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    }
    if (rateLimitResult.resetTime) {
      finalResponse.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
    }
    
    return finalResponse;
    
  } catch (error) {
    console.error('Pose detection error:', error);
    
    const processingTime = Date.now() - startTime;
    const response: PoseResponse = {
      success: false,
      message: 'ポーズ検出中にエラーが発生しました',
      processingTime: processingTime
    };
    
    return NextResponse.json(response, { status: 500 });
  }
}

// シンプルなGETエンドポイント（APIテスト用）
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Pose detection API is running',
    endpoints: {
      POST: '/api/pose - Upload image for pose detection',
    },
    supportedFormats: ['JPEG', 'PNG', 'WebP'],
    maxFileSize: '10MB'
  });
}