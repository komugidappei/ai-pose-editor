import { NextRequest, NextResponse } from 'next/server';
import { createCanvas, loadImage } from 'canvas';
import { rateLimit, rateLimitPresets } from '@/lib/rateLimit';

// ポーズキーポイントの型定義
interface Keypoint {
  name: string;
  x: number;
  y: number;
  confidence?: number;
}

interface GenerateRequest {
  prompt: string;
  pose: Keypoint[];
  resolution?: number;
  style?: string;
  background?: string;
  is_commercial?: boolean;
}

interface GenerateResponse {
  success: boolean;
  imageUrl?: string;
  image?: string;
  message?: string;
  error?: string;
  processing_time?: number;
  metadata?: {
    prompt: string;
    resolution: string;
    style: string;
    keypointCount: number;
    is_commercial: boolean;
  };
}

// ダミー画像を生成する関数
function generateDummyImage(prompt: string, pose: Keypoint[], resolution: number = 512): string {
  const canvas = createCanvas(resolution, resolution);
  const ctx = canvas.getContext('2d');
  
  // 背景をグラデーションで塗りつぶす
  const gradient = ctx.createLinearGradient(0, 0, 0, resolution);
  gradient.addColorStop(0, '#e0f2fe');
  gradient.addColorStop(1, '#f8fafc');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, resolution, resolution);
  
  // プロンプトテキストを表示
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('AI Generated Image', resolution / 2, 40);
  
  // プロンプトを表示
  ctx.font = '16px Arial';
  ctx.fillStyle = '#374151';
  const words = prompt.split(' ');
  let line = '';
  let y = 70;
  
  words.forEach((word, i) => {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > resolution - 40 && i > 0) {
      ctx.fillText(line, resolution / 2, y);
      line = word + ' ';
      y += 20;
    } else {
      line = testLine;
    }
  });
  ctx.fillText(line, resolution / 2, y);
  
  // ポーズのキーポイントを描画
  if (pose && pose.length > 0) {
    // キーポイントを描画
    pose.forEach((point, index) => {
      const x = point.x * resolution;
      const y = point.y * resolution;
      
      // キーポイントの円
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = `hsl(${(index * 360) / pose.length}, 70%, 50%)`;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // キーポイント名を表示
      ctx.fillStyle = '#1f2937';
      ctx.font = '10px Arial';
      ctx.fillText(point.name.replace('_', ' '), x + 10, y - 10);
    });
    
    // 骨格の接続線を描画
    const connections = [
      ['left_shoulder', 'right_shoulder'],
      ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'],
      ['right_shoulder', 'right_elbow'],
      ['right_elbow', 'right_wrist'],
      ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'],
      ['left_hip', 'right_hip'],
      ['left_hip', 'left_knee'],
      ['left_knee', 'left_ankle'],
      ['right_hip', 'right_knee'],
      ['right_knee', 'right_ankle'],
    ];
    
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    
    connections.forEach(([start, end]) => {
      const startPoint = pose.find(p => p.name === start);
      const endPoint = pose.find(p => p.name === end);
      
      if (startPoint && endPoint) {
        ctx.beginPath();
        ctx.moveTo(startPoint.x * resolution, startPoint.y * resolution);
        ctx.lineTo(endPoint.x * resolution, endPoint.y * resolution);
        ctx.stroke();
      }
    });
  }
  
  // メタデータを表示
  ctx.fillStyle = '#6b7280';
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`Resolution: ${resolution}x${resolution}`, 20, resolution - 60);
  ctx.fillText(`Keypoints: ${pose?.length || 0}`, 20, resolution - 40);
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 20, resolution - 20);
  
  // ウォーターマーク
  ctx.fillStyle = '#9ca3af';
  ctx.font = '10px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('AI Pose Editor Demo', resolution - 20, resolution - 10);
  
  return canvas.toDataURL('image/png');
}

// リクエストのバリデーション
function validateGenerateRequest(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.prompt || typeof data.prompt !== 'string' || data.prompt.trim().length === 0) {
    errors.push('プロンプトが必要です');
  }
  
  if (data.prompt && data.prompt.length > 500) {
    errors.push('プロンプトは500文字以下で入力してください');
  }
  
  if (!data.pose || !Array.isArray(data.pose)) {
    errors.push('ポーズデータが必要です');
  } else if (data.pose.length === 0) {
    errors.push('ポーズデータが空です');
  }
  
  if (data.resolution && (typeof data.resolution !== 'number' || data.resolution < 256 || data.resolution > 1024)) {
    errors.push('解像度は256-1024の範囲で指定してください');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// レート制限設定
const limiter = rateLimit(rateLimitPresets.imageGeneration);

// メインのPOSTエンドポイント
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. レート制限チェック
    const rateLimitResult = await limiter(request);
    if (!rateLimitResult.success && rateLimitResult.response) {
      return rateLimitResult.response;
    }
    // 2. FormDataをパース
    const formData = await request.formData();
    
    const prompt = formData.get('prompt') as string;
    const poseDataStr = formData.get('pose_data') as string;
    const style = formData.get('style') as string || 'realistic';
    const background = formData.get('background') as string || 'transparent';
    const resolution = parseInt(formData.get('resolution') as string || '512');
    const isCommercial = formData.get('is_commercial') === 'true';
    
    let pose: Keypoint[] = [];
    try {
      pose = JSON.parse(poseDataStr || '[]');
    } catch {
      pose = [];
    }
    
    const body: GenerateRequest = {
      prompt,
      pose,
      resolution,
      style,
      background,
      is_commercial: isCommercial
    };
    
    // バリデーション
    const validation = validateGenerateRequest(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: validation.errors.join(', ')
        },
        { status: 400 }
      );
    }
    
    console.log(`Generating image with prompt: "${prompt}", keypoints: ${pose.length}, resolution: ${resolution}x${resolution}`);
    
    // 生成時間をシミュレート（1-4秒）
    const processingDelay = 1000 + Math.random() * 3000;
    await new Promise(resolve => setTimeout(resolve, processingDelay));
    
    // TODO: 実際のAI画像生成APIを呼び出す
    // 例: Stability AI, Replicate, またはローカルControlNet
    
    // ダミー画像を生成
    const imageBase64 = generateDummyImage(prompt, pose, resolution);
    
    const processingTime = Date.now() - startTime;
    
    const response: GenerateResponse = {
      success: true,
      image: imageBase64,
      message: '画像生成が完了しました',
      processing_time: processingTime,
      metadata: {
        prompt: prompt,
        resolution: `${resolution}x${resolution}`,
        style: style,
        keypointCount: pose.length,
        is_commercial: isCommercial
      }
    };
    
    const finalResponse = NextResponse.json(response);
    
    // レート制限ヘッダーを追加
    if (rateLimitResult.remaining !== undefined) {
      finalResponse.headers.set('X-RateLimit-Limit', '5');
      finalResponse.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    }
    if (rateLimitResult.resetTime) {
      finalResponse.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
    }
    
    return finalResponse;
    
  } catch (error) {
    console.error('Image generation error:', error);
    
    const processingTime = Date.now() - startTime;
    const response: GenerateResponse = {
      success: false,
      error: '画像生成中にエラーが発生しました',
      processing_time: processingTime
    };
    
    return NextResponse.json(response, { status: 500 });
  }
}

// GETエンドポイント（APIテスト用）
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'AI Image Generation API is running',
    endpoints: {
      POST: '/api/generate - Generate image from prompt and pose data',
    },
    parameters: {
      prompt: 'string (required) - Text description for image generation',
      pose: 'Keypoint[] (required) - Array of pose keypoints',
      resolution: 'number (optional) - Image resolution, default 512px',
      style: 'string (optional) - Image style, default "realistic"',
      background: 'string (optional) - Background style, default "transparent"'
    },
    supportedResolutions: [256, 512, 768, 1024],
    maxPromptLength: 500
  });
}