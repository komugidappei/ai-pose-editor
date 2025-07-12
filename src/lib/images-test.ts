// Images テーブル用 RLS テスト
// Row Level Security の動作を確認するためのテスト関数

import { supabase } from './supabase';
import {
  createImage,
  getMyImages,
  getImageById,
  updateImage,
  deleteImage,
  searchImages,
  getPublicImages,
  getImageStats,
  toggleImagePublic,
  type CreateImageData,
  type ImageRecord
} from './images';

// テスト用のダミー画像データ
const TEST_IMAGE_DATA: CreateImageData = {
  filename: 'rls-test-image.png',
  original_name: 'RLS Test Image.png',
  mime_type: 'image/png',
  file_size: 2048,
  width: 512,
  height: 512,
  storage_path: '/test/rls-test-image.png',
  public_url: 'https://example.com/test-image.png',
  metadata: {
    test: true,
    description: 'RLSテスト用の画像'
  },
  is_public: false,
  tags: ['test', 'rls', 'security'],
  description: 'Row Level Security テスト用の画像です'
};

export interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  data?: any;
}

/**
 * 基本的なCRUD操作のテスト
 */
export async function testImageCRUD(): Promise<{
  success: boolean;
  results: TestResult[];
}> {
  const results: TestResult[] = [];
  let createdImageId: string | null = null;

  try {
    // 1. ユーザー認証状態の確認
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
      passed: true,
      data: { userId: user.id }
    });

    // 2. 画像レコードの作成
    const createResult = await createImage(TEST_IMAGE_DATA);
    if (createResult.error || !createResult.data) {
      results.push({
        test: '画像レコードの作成',
        passed: false,
        error: createResult.error || 'データが作成されませんでした'
      });
    } else {
      createdImageId = createResult.data.id;
      results.push({
        test: '画像レコードの作成',
        passed: true,
        data: { imageId: createdImageId }
      });
    }

    // 3. 自分の画像一覧を取得
    const listResult = await getMyImages({ limit: 10 });
    if (listResult.error || !listResult.data) {
      results.push({
        test: '自分の画像一覧を取得',
        passed: false,
        error: listResult.error || 'データが取得できませんでした'
      });
    } else {
      const hasTestImage = listResult.data.some(img => img.filename === TEST_IMAGE_DATA.filename);
      results.push({
        test: '自分の画像一覧を取得',
        passed: hasTestImage,
        data: { count: listResult.data.length, hasTestImage }
      });
    }

    // 4. 特定の画像を取得
    if (createdImageId) {
      const getResult = await getImageById(createdImageId);
      if (getResult.error || !getResult.data) {
        results.push({
          test: '特定の画像を取得',
          passed: false,
          error: getResult.error || 'データが取得できませんでした'
        });
      } else {
        results.push({
          test: '特定の画像を取得',
          passed: getResult.data.filename === TEST_IMAGE_DATA.filename,
          data: { filename: getResult.data.filename }
        });
      }
    }

    // 5. 画像レコードの更新
    if (createdImageId) {
      const updateResult = await updateImage(createdImageId, {
        description: 'RLSテスト - 更新済み',
        tags: ['test', 'rls', 'updated']
      });
      
      if (updateResult.error || !updateResult.data) {
        results.push({
          test: '画像レコードの更新',
          passed: false,
          error: updateResult.error || 'データが更新できませんでした'
        });
      } else {
        results.push({
          test: '画像レコードの更新',
          passed: updateResult.data.description?.includes('更新済み') || false,
          data: { description: updateResult.data.description }
        });
      }
    }

    // 6. 公開状態の切り替え
    if (createdImageId) {
      const toggleResult = await toggleImagePublic(createdImageId);
      if (toggleResult.error || !toggleResult.data) {
        results.push({
          test: '公開状態の切り替え',
          passed: false,
          error: toggleResult.error || 'データが更新できませんでした'
        });
      } else {
        results.push({
          test: '公開状態の切り替え',
          passed: toggleResult.data.is_public === true,
          data: { isPublic: toggleResult.data.is_public }
        });
      }
    }

    // 7. 検索機能のテスト
    const searchResult = await searchImages({
      tags: ['test'],
      limit: 5
    });
    
    if (searchResult.error || !searchResult.data) {
      results.push({
        test: '検索機能のテスト',
        passed: false,
        error: searchResult.error || 'データが取得できませんでした'
      });
    } else {
      results.push({
        test: '検索機能のテスト',
        passed: searchResult.data.length > 0,
        data: { count: searchResult.data.length }
      });
    }

    // 8. 統計情報の取得
    const statsResult = await getImageStats();
    if (statsResult.error) {
      results.push({
        test: '統計情報の取得',
        passed: false,
        error: statsResult.error
      });
    } else {
      results.push({
        test: '統計情報の取得',
        passed: statsResult.totalImages >= 0,
        data: statsResult
      });
    }

  } catch (error) {
    results.push({
      test: 'CRUD操作テスト実行',
      passed: false,
      error: error instanceof Error ? error.message : '予期しないエラー'
    });
  }

  // クリーンアップ：作成したテストデータを削除
  if (createdImageId) {
    const deleteResult = await deleteImage(createdImageId);
    results.push({
      test: 'テストデータのクリーンアップ',
      passed: !deleteResult.error,
      error: deleteResult.error || undefined
    });
  }

  const allPassed = results.every(result => result.passed);
  return { success: allPassed, results };
}

/**
 * セキュリティテスト（他ユーザーのデータへの不正アクセス）
 */
export async function testImageSecurity(): Promise<{
  success: boolean;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  try {
    // 1. 他人のuser_idでの直接挿入試行（Supabaseクライアント経由）
    const fakeUserId = '00000000-0000-0000-0000-000000000000';
    const { error: directInsertError } = await supabase
      .from('images')
      .insert([{
        ...TEST_IMAGE_DATA,
        user_id: fakeUserId,
        filename: 'security-test-fake.png'
      }]);

    results.push({
      test: '他人のuser_idでの直接挿入試行（失敗すべき）',
      passed: !!directInsertError, // エラーが発生すれば成功
      error: directInsertError ? undefined : '本来失敗すべき操作が成功してしまいました',
      data: { errorCode: directInsertError?.code }
    });

    // 2. 存在しない画像IDでの取得試行
    const fakeImageId = '00000000-0000-0000-0000-000000000000';
    const { error: getError, statusCode } = await getImageById(fakeImageId);
    
    results.push({
      test: '存在しない画像IDでの取得試行',
      passed: !!getError && statusCode === 404,
      error: !getError ? '本来失敗すべき操作が成功してしまいました' : undefined,
      data: { statusCode, errorMessage: getError }
    });

    // 3. 全ての画像を取得試行（自分の画像のみ返ってくるべき）
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: allImages, error: allImagesError } = await supabase
        .from('images')
        .select('*');

      if (allImagesError) {
        results.push({
          test: '全画像取得（自分の分のみ取得されるべき）',
          passed: false,
          error: allImagesError.message
        });
      } else {
        const allImagesAreOwn = allImages?.every(img => img.user_id === user.id) ?? true;
        results.push({
          test: '全画像取得（自分の分のみ取得されるべき）',
          passed: allImagesAreOwn,
          data: { 
            totalImages: allImages?.length || 0,
            allImagesAreOwn,
            userIds: [...new Set(allImages?.map(img => img.user_id) || [])]
          }
        });
      }
    }

    // 4. 認証なしでの公開画像取得
    const publicImagesResult = await getPublicImages({ limit: 5 });
    results.push({
      test: '公開画像の取得',
      passed: !publicImagesResult.error,
      error: publicImagesResult.error || undefined,
      data: { count: publicImagesResult.data?.length || 0 }
    });

  } catch (error) {
    results.push({
      test: 'セキュリティテスト実行',
      passed: false,
      error: error instanceof Error ? error.message : '予期しないエラー'
    });
  }

  const allPassed = results.every(result => result.passed);
  return { success: allPassed, results };
}

/**
 * パフォーマンステスト
 */
export async function testImagePerformance(imageCount: number = 20): Promise<{
  success: boolean;
  executionTime: number;
  results: TestResult[];
}> {
  const startTime = Date.now();
  const results: TestResult[] = [];
  const createdImageIds: string[] = [];

  try {
    // 大量の画像データを作成
    const createPromises = Array.from({ length: imageCount }, (_, index) => 
      createImage({
        ...TEST_IMAGE_DATA,
        filename: `performance-test-${index}.png`,
        description: `パフォーマンステスト画像 ${index + 1}`
      })
    );

    const createResults = await Promise.all(createPromises);
    const successfulCreates = createResults.filter(result => !result.error && result.data);
    
    successfulCreates.forEach(result => {
      if (result.data) {
        createdImageIds.push(result.data.id);
      }
    });

    results.push({
      test: `${imageCount}件の画像レコード作成`,
      passed: successfulCreates.length === imageCount,
      data: { 
        requested: imageCount, 
        created: successfulCreates.length,
        failed: imageCount - successfulCreates.length
      }
    });

    // 作成した画像を一括取得
    const listResult = await getMyImages({ limit: imageCount + 10 });
    const performanceImages = listResult.data?.filter(img => 
      img.filename.startsWith('performance-test-')
    ) || [];

    results.push({
      test: '大量データの取得',
      passed: performanceImages.length === createdImageIds.length,
      data: { 
        expected: createdImageIds.length,
        retrieved: performanceImages.length
      }
    });

    // 検索パフォーマンス
    const searchStartTime = Date.now();
    const searchResult = await searchImages({
      query: 'パフォーマンステスト',
      limit: imageCount
    });
    const searchTime = Date.now() - searchStartTime;

    results.push({
      test: '検索パフォーマンス',
      passed: !searchResult.error && searchTime < 2000, // 2秒以内
      data: { 
        searchTime,
        resultCount: searchResult.data?.length || 0
      }
    });

  } catch (error) {
    results.push({
      test: 'パフォーマンステスト実行',
      passed: false,
      error: error instanceof Error ? error.message : '予期しないエラー'
    });
  }

  // クリーンアップ
  if (createdImageIds.length > 0) {
    const deletePromises = createdImageIds.map(id => deleteImage(id));
    const deleteResults = await Promise.all(deletePromises);
    const successfulDeletes = deleteResults.filter(result => !result.error);

    results.push({
      test: 'テストデータのクリーンアップ',
      passed: successfulDeletes.length === createdImageIds.length,
      data: { 
        toDelete: createdImageIds.length,
        deleted: successfulDeletes.length
      }
    });
  }

  const executionTime = Date.now() - startTime;
  const allPassed = results.every(result => result.passed);

  return { success: allPassed, executionTime, results };
}

/**
 * 総合テストレポートを生成
 */
export async function generateImageTestReport(): Promise<string> {
  console.log('🖼️ Images テーブル RLS テストを開始...');
  
  const crudTest = await testImageCRUD();
  const securityTest = await testImageSecurity();
  const performanceTest = await testImagePerformance(10);

  let report = '# Images テーブル Row Level Security (RLS) テストレポート\n\n';
  
  report += '## CRUD操作テスト\n\n';
  crudTest.results.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    report += `${index + 1}. ${status} ${result.test}\n`;
    if (result.error) {
      report += `   エラー: ${result.error}\n`;
    }
    if (result.data) {
      report += `   詳細: ${JSON.stringify(result.data, null, 2)}\n`;
    }
  });

  report += `\n**CRUD操作テスト結果**: ${crudTest.success ? '✅ 成功' : '❌ 失敗'}\n\n`;

  report += '## セキュリティテスト\n\n';
  securityTest.results.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    report += `${index + 1}. ${status} ${result.test}\n`;
    if (result.error) {
      report += `   エラー: ${result.error}\n`;
    }
    if (result.data) {
      report += `   詳細: ${JSON.stringify(result.data, null, 2)}\n`;
    }
  });

  report += `\n**セキュリティテスト結果**: ${securityTest.success ? '✅ 成功' : '❌ 失敗'}\n\n`;

  report += '## パフォーマンステスト\n\n';
  performanceTest.results.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    report += `${index + 1}. ${status} ${result.test}\n`;
    if (result.error) {
      report += `   エラー: ${result.error}\n`;
    }
    if (result.data) {
      report += `   詳細: ${JSON.stringify(result.data, null, 2)}\n`;
    }
  });

  report += `\n**パフォーマンステスト結果**: ${performanceTest.success ? '✅ 成功' : '❌ 失敗'}\n`;
  report += `**実行時間**: ${performanceTest.executionTime}ms\n\n`;

  report += '## RLS設定情報\n\n';
  report += '```sql\n';
  report += '-- images テーブルにRLSを適用済み\n';
  report += 'ALTER TABLE images ENABLE ROW LEVEL SECURITY;\n\n';
  report += '-- ユーザーは自分のデータ + 公開データのみアクセス可能\n';
  report += 'CREATE POLICY "Users can view own images" ON images\n';
  report += '    FOR SELECT USING (auth.uid() = user_id OR is_public = true);\n\n';
  report += 'CREATE POLICY "Users can insert own images" ON images\n';
  report += '    FOR INSERT WITH CHECK (auth.uid() = user_id);\n';
  report += '```\n\n';

  report += '## 総合結果\n\n';
  const overallSuccess = crudTest.success && securityTest.success && performanceTest.success;
  report += `**総合テスト結果**: ${overallSuccess ? '✅ 全テスト成功' : '❌ 一部テスト失敗'}\n\n`;

  console.log(report);
  return report;
}