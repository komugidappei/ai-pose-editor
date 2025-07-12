// セキュリティ強化版の画像生成APIエンドポイント
// 全ての対策を統合した安全な画像生成API

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sanitizeImage } from '@/lib/imageUpload';
import { validateRecaptchaMiddleware } from '@/lib/recaptcha';
import { escapeHtml, sanitizePrompt, validateUserInput } from '@/lib/htmlEscape';
import { prepareForImageSave } from '@/lib/imageLimit';
import { 
  checkDailyGenerationLimit, 
  incrementDailyGenerationCount, 
  getClientIpAddress, 
  createRateLimitErrorResponse 
} from '@/lib/dailyGenerationLimit';
import { uploadBase64ImageToPrivateStorage, createSignedUrl } from '@/lib/signedUrl';
import { addUserWatermark } from '@/lib/watermark';
import { createImage } from '@/lib/images';
import { saveGeneratedImage } from '@/lib/generatedImageStorage';
import { rateLimit, rateLimitPresets } from '@/lib/rateLimit';
import { sanitizeAllTextInputs, validateSpecificFields } from '@/lib/inputSanitization';

// レート制限設定
const limiter = rateLimit(rateLimitPresets.imageGeneration);

/**
 * ユーザー認証状態の確認
 */
async function getUserFromRequest(request: NextRequest): Promise<{ user: any; isAuthenticated: boolean }> {
  try {
    // Authorization ヘッダーからトークンを取得
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, isAuthenticated: false };
    }

    const token = authHeader.substring(7);
    
    // Supabaseでユーザー情報を取得
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { user: null, isAuthenticated: false };
    }

    return { user, isAuthenticated: true };

  } catch (error) {
    console.error('ユーザー認証確認エラー:', error);
    return { user: null, isAuthenticated: false };
  }
}

/**
 * リクエストボディの検証とサニタイズ
 */
function validateAndSanitizeRequest(body: any): {
  isValid: boolean;
  sanitizedData?: any;
  errors?: string[];
} {
  const errors: string[] = [];

  // 必須フィールドの確認
  if (!body.prompt) {
    errors.push('プロンプトは必須です');
  }

  if (!body.poseData) {
    errors.push('ポーズデータは必須です');
  }

  // プロンプトの検証とサニタイズ
  let sanitizedPrompt = '';
  if (body.prompt) {
    const promptValidation = validateUserInput(body.prompt, {
      maxLength: 1000,
      allowHtml: false,
      allowNewlines: false
    });
    
    if (!promptValidation.isValid) {
      errors.push(...promptValidation.errors);
    } else {
      sanitizedPrompt = sanitizePrompt(promptValidation.sanitized);
    }
  }

  // その他のフィールドをサニタイズ
  const sanitizedData = {
    prompt: sanitizedPrompt,
    poseData: body.poseData, // JSONデータはそのまま（別途検証）
    style: escapeHtml(body.style || 'リアル'),
    background: escapeHtml(body.background || '透明'),
    resolution: escapeHtml(body.resolution || '512'),
    isCommercial: Boolean(body.isCommercial),
    aiStyleId: escapeHtml(body.aiStyleId || ''),
    recaptchaToken: body.recaptchaToken
  };

  return {
    isValid: errors.length === 0,
    sanitizedData,
    errors
  };
}

/**
 * モックの画像生成処理
 */
async function generateMockImage(
  prompt: string,
  poseData: any,
  style: string,
  background: string,
  resolution: string
): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
  try {
    // 実際のAI画像生成ロジックをここに実装
    // 今回はモックとして固定の画像を返す
    
    // 簡単なキャンバス画像を生成
    if (typeof window === 'undefined') {
      // サーバーサイドでの処理
      return {
        success: true,
        imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      };
    }

    return {
      success: false,
      error: 'サーバーサイド画像生成が未実装です'
    };

  } catch (error) {
    console.error('画像生成エラー:', error);
    return {
      success: false,
      error: '画像生成中にエラーが発生しました'
    };
  }
}

/**
 * メインのPOSTハンドラー
 */
export async function POST(request: NextRequest) {
  try {
    // 1. レート制限チェック
    const rateLimitResult = await limiter(request);
    if (!rateLimitResult.success && rateLimitResult.response) {
      return rateLimitResult.response;
    }

    // 2. リクエストボディの取得と包括的サニタイズ
    const body = await request.json();
    const sanitizedBody = sanitizeAllTextInputs(body);
    const validation = validateAndSanitizeRequest(sanitizedBody);
    
    // 3. 特定フィールドの厳密なバリデーション
    const fieldValidation = validateSpecificFields(sanitizedBody);
    if (!fieldValidation.isValid) {
      return NextResponse.json(
        { 
          error: '入力データの検証に失敗しました',
          details: Object.values(fieldValidation.errors).flat()
        },
        { status: 400 }
      );
    }
    
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: '入力データに問題があります',
          details: validation.errors 
        },
        { status: 400 }
      );
    }

    const sanitizedData = validation.sanitizedData!;

    // 3. ユーザー認証確認
    const { user, isAuthenticated } = await getUserFromRequest(request);
    const userId = user?.id || 'guest';

    // 4. reCAPTCHA検証（ゲストユーザー必須）
    if (!isAuthenticated) {
      // ゲストユーザーはreCAPTCHA必須
      if (!sanitizedData.recaptchaToken) {
        return NextResponse.json(
          { 
            error: '画像生成にはreCAPTCHA認証が必要です',
            requiresRecaptcha: true,
            message: 'ゲストユーザーは認証を完了してから画像生成を行ってください'
          },
          { status: 403 }
        );
      }

      // reCAPTCHA v2専用検証
      const { verifyImageGenerationRecaptcha } = await import('@/lib/recaptcha');
      const clientIp = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown';

      const recaptchaResult = await verifyImageGenerationRecaptcha(
        sanitizedData.recaptchaToken,
        isAuthenticated,
        clientIp
      );

      if (!recaptchaResult.success) {
        return NextResponse.json(
          { 
            error: recaptchaResult.error || 'reCAPTCHA認証に失敗しました',
            requiresRecaptcha: true,
            message: 'もう一度reCAPTCHA認証を完了してください'
          },
          { status: 403 }
        );
      }

      console.log('✅ Guest user passed reCAPTCHA verification');
    } else {
      console.log('✅ Authenticated user - reCAPTCHA skipped');
    }

    // 5. 1日あたりの生成制限チェック（1日10回制限）
    const clientIp = !isAuthenticated ? getClientIpAddress(request) : undefined;
    const dailyLimitResult = await checkDailyGenerationLimit(userId, clientIp, 10);
    
    if (!dailyLimitResult.canGenerate) {
      console.log(`⛔ Daily generation limit exceeded for ${userId === 'guest' ? `IP: ${clientIp}` : `user: ${userId}`}`);
      return createRateLimitErrorResponse(dailyLimitResult);
    }
    
    console.log(`✅ Daily limit check passed: ${dailyLimitResult.currentCount}/${dailyLimitResult.limit} generations used`);

    // 6. 保存画像数制限チェック（画像を保存する場合）
    const imageLimitResult = await prepareForImageSave(userId);
    if (!imageLimitResult.canProceed) {
      return NextResponse.json(
        { 
          error: imageLimitResult.message,
          details: imageLimitResult.errors 
        },
        { status: 409 }
      );
    }

    // 7. 画像生成実行
    const generationResult = await generateMockImage(
      sanitizedData.prompt,
      sanitizedData.poseData,
      sanitizedData.style,
      sanitizedData.background,
      sanitizedData.resolution
    );

    if (!generationResult.success || !generationResult.imageBase64) {
      return NextResponse.json(
        { error: generationResult.error || '画像生成に失敗しました' },
        { status: 500 }
      );
    }

    // 8. ウォーターマーク追加（Freeユーザーのみ、商用ユーザーは除外）
    const watermarkResult = await addUserWatermark(
      userId, 
      generationResult.imageBase64, 
      sanitizedData.isCommercial
    );
    
    if (!watermarkResult.success) {
      console.warn('ウォーターマーク追加に失敗:', watermarkResult.error);
      // ウォーターマーク失敗は致命的ではないので続行
    } else {
      console.log(`🎨 Watermark ${watermarkResult.imageData ? 'added' : 'skipped'} for user ${userId}`);
    }

    const finalImageBase64 = watermarkResult.imageData || generationResult.imageBase64;

    // 9. 画像をプライベートストレージにアップロード
    const uploadResult = await uploadBase64ImageToPrivateStorage(userId, finalImageBase64, {
      fileName: `generated_${Date.now()}.png`,
      bucketName: 'private-images'
    });

    if (!uploadResult.success) {
      console.error('画像アップロード失敗:', uploadResult.error);
      // アップロード失敗時もBase64で返す
    }

    // 10. 署名付きURLを生成
    let signedUrl: string | undefined;
    if (uploadResult.success && uploadResult.filePath) {
      const signedUrlResult = await createSignedUrl(
        'private-images',
        uploadResult.filePath,
        300 // 5分間有効
      );
      
      if (signedUrlResult.success) {
        signedUrl = signedUrlResult.signedUrl;
      }
    }

    // 11. AI生成画像をデータベースに保存（10枚制限の自動削除付き）
    let imageRecord = null;
    let autoDeletedCount = 0;
    
    if (userId !== 'guest') {
      // 認証済みユーザー及びゲストユーザーの画像を保存
      const saveResult = await saveGeneratedImage({
        user_id: userId,
        prompt: sanitizedData.prompt,
        pose_data: sanitizedData.poseData,
        image_url: uploadResult.filePath,
        image_base64: finalImageBase64,
        is_commercial: sanitizedData.isCommercial,
        resolution: sanitizedData.resolution,
        style: sanitizedData.style,
        background: sanitizedData.background,
        processing_time: Date.now() - parseInt(request.headers.get('x-start-time') || '0'),
        ai_style_id: sanitizedData.aiStyleId,
      });

      if (saveResult.success) {
        imageRecord = { id: saveResult.imageId };
        autoDeletedCount = saveResult.deletedOldImages || 0;
        
        if (autoDeletedCount > 0) {
          console.log(`🗑️ Auto-deleted ${autoDeletedCount} old images for user ${userId}`);
        }
      } else {
        console.warn('Generated image save failed:', saveResult.error);
      }
    }

    // 12. 生成回数をインクリメント（成功時のみ）
    const incrementResult = await incrementDailyGenerationCount(userId, clientIp);
    if (!incrementResult.success) {
      console.warn('生成回数インクリメント失敗:', incrementResult.message);
    } else {
      console.log(`📈 Daily generation count incremented: ${incrementResult.newCount}/10`);
    }

    // 13. レスポンスを返す
    const response = {
      success: true,
      image: finalImageBase64,
      signedUrl,
      imageRecord,
      metadata: {
        prompt: sanitizedData.prompt,
        style: sanitizedData.style,
        background: sanitizedData.background,
        resolution: sanitizedData.resolution,
        isCommercial: sanitizedData.isCommercial,
        hasWatermark: watermarkResult.success,
        processingTime: Date.now() - parseInt(request.headers.get('x-start-time') || '0'),
        remainingGenerations: dailyLimitResult.remaining,
        deletedOldImages: autoDeletedCount
      }
    };

    const finalResponse = NextResponse.json(response, { status: 200 });
    
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
    console.error('セキュア画像生成API エラー:', error);
    
    return NextResponse.json(
      { 
        error: '画像生成中に予期しないエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * オプション: CORSヘッダーの設定
 */
export async function OPTIONS(request: NextRequest) {
  // OPTIONSリクエストにはレート制限を適用しない（プリフライトリクエストのため）
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}