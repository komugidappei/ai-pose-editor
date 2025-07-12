// Row Level Security (RLS) テスト用ユーティリティ
// このファイルはRLSポリシーが正しく動作することをテストするためのものです

import { supabase } from './supabase';
import { GeneratedImage } from './gallery';

// テスト用のダミーデータ
const TEST_IMAGE_DATA: Omit<GeneratedImage, 'id' | 'created_at' | 'updated_at'> = {
  user_id: '', // テスト時に設定
  prompt: 'テスト用プロンプト - RLSポリシーのテスト',
  pose_data: {
    head: { x: 0, y: 0, z: 0 },
    left_shoulder: { x: -1.5708, y: 0, z: 0 },
    right_shoulder: { x: 1.5708, y: 0, z: 0 }
  },
  image_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  is_commercial: false,
  resolution: '512x512',
  style: 'テスト',
  background: 'テスト',
  processing_time: 1000
};

/**
 * RLSポリシーの基本テスト
 */
export async function testBasicRLS(): Promise<{
  success: boolean;
  results: Array<{
    test: string;
    passed: boolean;
    error?: string;
  }>;
}> {
  const results: Array<{
    test: string;
    passed: boolean;
    error?: string;
  }> = [];

  try {
    // 1. 認証状態の確認
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      results.push({
        test: 'ユーザー認証状態の確認',
        passed: false,
        error: 'ユーザーが認証されていません'
      });
      return { success: false, results };
    }

    results.push({
      test: 'ユーザー認証状態の確認',
      passed: true
    });

    // 2. 自分の画像を挿入
    const insertData = { ...TEST_IMAGE_DATA, user_id: user.id };
    const { data: insertedImage, error: insertError } = await supabase
      .from('generated_images')
      .insert([insertData])
      .select()
      .single();

    if (insertError) {
      results.push({
        test: '自分の画像を挿入',
        passed: false,
        error: insertError.message
      });
    } else {
      results.push({
        test: '自分の画像を挿入',
        passed: true
      });
    }

    // 3. 自分の画像を読み込み
    const { data: ownImages, error: selectError } = await supabase
      .from('generated_images')
      .select('*')
      .eq('user_id', user.id);

    if (selectError) {
      results.push({
        test: '自分の画像を読み込み',
        passed: false,
        error: selectError.message
      });
    } else {
      const hasTestImage = ownImages?.some(img => img.prompt.includes('RLSポリシーのテスト'));
      results.push({
        test: '自分の画像を読み込み',
        passed: hasTestImage || false
      });
    }

    // 4. 他人のuser_idで画像を挿入試行（失敗すべき）
    const fakeUserId = 'fake-user-id-12345';
    const { error: fakeInsertError } = await supabase
      .from('generated_images')
      .insert([{ ...TEST_IMAGE_DATA, user_id: fakeUserId }]);

    results.push({
      test: '他人のuser_idで画像挿入試行（失敗すべき）',
      passed: !!fakeInsertError, // エラーが発生すれば成功
      error: fakeInsertError ? undefined : '本来失敗すべき操作が成功してしまいました'
    });

    // 5. 全ての画像を取得試行（自分の分のみ返ってくるべき）
    const { data: allImages, error: allSelectError } = await supabase
      .from('generated_images')
      .select('*');

    if (allSelectError) {
      results.push({
        test: '全画像取得（自分の分のみ取得されるべき）',
        passed: false,
        error: allSelectError.message
      });
    } else {
      const allImagesAreOwn = allImages?.every(img => img.user_id === user.id) ?? true;
      results.push({
        test: '全画像取得（自分の分のみ取得されるべき）',
        passed: allImagesAreOwn
      });
    }

    // 6. 挿入した画像を更新
    if (insertedImage) {
      const { error: updateError } = await supabase
        .from('generated_images')
        .update({ prompt: 'RLSテスト - 更新済み' })
        .eq('id', insertedImage.id);

      results.push({
        test: '自分の画像を更新',
        passed: !updateError,
        error: updateError?.message
      });
    }

    // 7. 挿入した画像を削除
    if (insertedImage) {
      const { error: deleteError } = await supabase
        .from('generated_images')
        .delete()
        .eq('id', insertedImage.id);

      results.push({
        test: '自分の画像を削除',
        passed: !deleteError,
        error: deleteError?.message
      });
    }

  } catch (error) {
    results.push({
      test: 'RLSテスト実行',
      passed: false,
      error: error instanceof Error ? error.message : '予期しないエラー'
    });
  }

  const allPassed = results.every(result => result.passed);
  return { success: allPassed, results };
}

/**
 * パフォーマンステスト（大量データでのRLS）
 */
export async function testRLSPerformance(imageCount: number = 100): Promise<{
  success: boolean;
  executionTime: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        executionTime: 0,
        error: 'ユーザーが認証されていません'
      };
    }

    // 大量の画像データを挿入
    const imagesToInsert = Array.from({ length: imageCount }, (_, index) => ({
      ...TEST_IMAGE_DATA,
      user_id: user.id,
      prompt: `RLSパフォーマンステスト画像 ${index + 1}`
    }));

    const { error: insertError } = await supabase
      .from('generated_images')
      .insert(imagesToInsert);

    if (insertError) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        error: `挿入エラー: ${insertError.message}`
      };
    }

    // 挿入した画像を取得
    const { data: images, error: selectError } = await supabase
      .from('generated_images')
      .select('*')
      .eq('user_id', user.id)
      .ilike('prompt', '%RLSパフォーマンステスト%');

    if (selectError) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        error: `取得エラー: ${selectError.message}`
      };
    }

    // 挿入した画像を削除（クリーンアップ）
    const { error: deleteError } = await supabase
      .from('generated_images')
      .delete()
      .eq('user_id', user.id)
      .ilike('prompt', '%RLSパフォーマンステスト%');

    if (deleteError) {
      console.warn('テストデータの削除に失敗:', deleteError.message);
    }

    const executionTime = Date.now() - startTime;
    const expectedImageCount = imageCount;
    const actualImageCount = images?.length || 0;

    return {
      success: actualImageCount === expectedImageCount,
      executionTime,
      error: actualImageCount !== expectedImageCount 
        ? `期待: ${expectedImageCount}件, 実際: ${actualImageCount}件`
        : undefined
    };

  } catch (error) {
    return {
      success: false,
      executionTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : '予期しないエラー'
    };
  }
}

/**
 * RLSポリシーの詳細テストレポートを生成
 */
export async function generateRLSTestReport(): Promise<string> {
  console.log('🔒 Row Level Security (RLS) テストを開始...');
  
  const basicTest = await testBasicRLS();
  const performanceTest = await testRLSPerformance(10);

  let report = '# Row Level Security (RLS) テストレポート\n\n';
  
  report += '## 基本機能テスト\n\n';
  basicTest.results.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    report += `${index + 1}. ${status} ${result.test}\n`;
    if (result.error) {
      report += `   エラー: ${result.error}\n`;
    }
  });

  report += `\n**基本テスト結果**: ${basicTest.success ? '✅ 成功' : '❌ 失敗'}\n\n`;

  report += '## パフォーマンステスト\n\n';
  report += `- 実行時間: ${performanceTest.executionTime}ms\n`;
  report += `- 結果: ${performanceTest.success ? '✅ 成功' : '❌ 失敗'}\n`;
  if (performanceTest.error) {
    report += `- エラー: ${performanceTest.error}\n`;
  }

  report += '\n## 推奨設定\n\n';
  report += '```sql\n';
  report += '-- generated_images テーブルにRLSを適用済み\n';
  report += 'ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;\n\n';
  report += '-- ユーザーは自分のデータのみアクセス可能\n';
  report += 'CREATE POLICY "Users can view own images" ON generated_images\n';
  report += '    FOR SELECT USING (auth.uid()::text = user_id);\n';
  report += '```\n\n';

  console.log(report);
  return report;
}