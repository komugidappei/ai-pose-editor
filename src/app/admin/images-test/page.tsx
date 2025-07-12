'use client';

import { useState } from 'react';
import Layout from '@/components/Layout';
import { 
  testImageCRUD, 
  testImageSecurity, 
  testImagePerformance, 
  generateImageTestReport 
} from '@/lib/images-test';
import { getImageStats, formatFileSize } from '@/lib/images';

export default function ImagesTestPage() {
  const [isTestingCRUD, setIsTestingCRUD] = useState(false);
  const [isTestingSecurity, setIsTestingSecurity] = useState(false);
  const [isTestingPerformance, setIsTestingPerformance] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  
  const [crudResults, setCrudResults] = useState<any>(null);
  const [securityResults, setSecurityResults] = useState<any>(null);
  const [performanceResults, setPerformanceResults] = useState<any>(null);
  const [imageStats, setImageStats] = useState<any>(null);
  const [testReport, setTestReport] = useState<string>('');

  const runCRUDTest = async () => {
    setIsTestingCRUD(true);
    try {
      const results = await testImageCRUD();
      setCrudResults(results);
      console.log('CRUD Test Results:', results);
    } catch (error) {
      console.error('CRUD test failed:', error);
      setCrudResults({
        success: false,
        results: [{ 
          test: 'CRUD テスト実行', 
          passed: false, 
          error: error instanceof Error ? error.message : '予期しないエラー' 
        }]
      });
    } finally {
      setIsTestingCRUD(false);
    }
  };

  const runSecurityTest = async () => {
    setIsTestingSecurity(true);
    try {
      const results = await testImageSecurity();
      setSecurityResults(results);
      console.log('Security Test Results:', results);
    } catch (error) {
      console.error('Security test failed:', error);
      setSecurityResults({
        success: false,
        results: [{ 
          test: 'セキュリティテスト実行', 
          passed: false, 
          error: error instanceof Error ? error.message : '予期しないエラー' 
        }]
      });
    } finally {
      setIsTestingSecurity(false);
    }
  };

  const runPerformanceTest = async () => {
    setIsTestingPerformance(true);
    try {
      const results = await testImagePerformance(15);
      setPerformanceResults(results);
      console.log('Performance Test Results:', results);
    } catch (error) {
      console.error('Performance test failed:', error);
      setPerformanceResults({
        success: false,
        executionTime: 0,
        results: [{ 
          test: 'パフォーマンステスト実行', 
          passed: false, 
          error: error instanceof Error ? error.message : '予期しないエラー' 
        }]
      });
    } finally {
      setIsTestingPerformance(false);
    }
  };

  const loadImageStats = async () => {
    setIsLoadingStats(true);
    try {
      const stats = await getImageStats();
      setImageStats(stats);
    } catch (error) {
      console.error('Failed to load image stats:', error);
      setImageStats({ error: '統計の取得に失敗しました' });
    } finally {
      setIsLoadingStats(false);
    }
  };

  const generateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const report = await generateImageTestReport();
      setTestReport(report);
    } catch (error) {
      console.error('Report generation failed:', error);
      setTestReport('レポート生成に失敗しました: ' + (error instanceof Error ? error.message : '予期しないエラー'));
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const renderTestResults = (results: any, title: string) => {
    if (!results) return null;

    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <div className={`font-semibold mb-2 ${
          results.success ? 'text-green-600' : 'text-red-600'
        }`}>
          {results.success ? '✅ テスト成功' : '❌ テスト失敗'}
          {results.executionTime && (
            <span className="text-gray-600 text-sm ml-2">
              ({results.executionTime}ms)
            </span>
          )}
        </div>
        <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
          {results.results.map((result: any, index: number) => (
            <div key={index} className="border-l-2 border-gray-300 pl-3">
              <div className="flex items-start space-x-2">
                <span className="mt-0.5">{result.passed ? '✅' : '❌'}</span>
                <div className="flex-1">
                  <div className="font-medium">{result.test}</div>
                  {result.error && (
                    <div className="text-red-600 text-xs mt-1">{result.error}</div>
                  )}
                  {result.data && (
                    <details className="mt-1">
                      <summary className="text-gray-600 text-xs cursor-pointer">詳細データ</summary>
                      <pre className="text-xs text-gray-500 mt-1 p-2 bg-gray-100 rounded overflow-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center space-x-2">
            <span>🖼️</span>
            <span>Images テーブル RLS テスト</span>
          </h1>
          <p className="text-gray-600">
            画像管理テーブルのRow Level Securityポリシーの動作を確認します
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* テスト実行セクション */}
          <div className="space-y-6">
            {/* 画像統計 */}
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">画像統計</h2>
              <button
                onClick={loadImageStats}
                disabled={isLoadingStats}
                className={`w-full py-2 mb-4 rounded-lg font-medium transition-colors ${
                  isLoadingStats
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isLoadingStats ? '読み込み中...' : '統計を取得'}
              </button>

              {imageStats && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-blue-800 font-medium">総画像数</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {imageStats.totalImages || 0}
                    </div>
                  </div>
                  <div className="p-3 bg-green-50 rounded">
                    <div className="text-green-800 font-medium">合計サイズ</div>
                    <div className="text-2xl font-bold text-green-900">
                      {formatFileSize(imageStats.totalSize || 0)}
                    </div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded">
                    <div className="text-purple-800 font-medium">公開画像</div>
                    <div className="text-2xl font-bold text-purple-900">
                      {imageStats.publicImages || 0}
                    </div>
                  </div>
                  <div className="p-3 bg-orange-50 rounded">
                    <div className="text-orange-800 font-medium">最近の画像</div>
                    <div className="text-2xl font-bold text-orange-900">
                      {imageStats.recentImages || 0}
                    </div>
                    <div className="text-xs text-orange-600">過去7日間</div>
                  </div>
                </div>
              )}
            </div>

            {/* CRUD操作テスト */}
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">CRUD操作テスト</h2>
              <p className="text-gray-600 text-sm mb-4">
                作成・読み込み・更新・削除の基本操作を確認します
              </p>
              
              <button
                onClick={runCRUDTest}
                disabled={isTestingCRUD}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  isTestingCRUD
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isTestingCRUD ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>テスト実行中...</span>
                  </div>
                ) : (
                  'CRUD操作テストを実行'
                )}
              </button>

              {renderTestResults(crudResults, 'CRUD操作')}
            </div>

            {/* セキュリティテスト */}
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">セキュリティテスト</h2>
              <p className="text-gray-600 text-sm mb-4">
                不正アクセスの防止とRLSポリシーの動作を確認します
              </p>
              
              <button
                onClick={runSecurityTest}
                disabled={isTestingSecurity}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  isTestingSecurity
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {isTestingSecurity ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>テスト実行中...</span>
                  </div>
                ) : (
                  'セキュリティテストを実行'
                )}
              </button>

              {renderTestResults(securityResults, 'セキュリティ')}
            </div>

            {/* パフォーマンステスト */}
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">パフォーマンステスト</h2>
              <p className="text-gray-600 text-sm mb-4">
                大量データでのRLS実行速度を測定します
              </p>
              
              <button
                onClick={runPerformanceTest}
                disabled={isTestingPerformance}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  isTestingPerformance
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isTestingPerformance ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>テスト実行中...</span>
                  </div>
                ) : (
                  'パフォーマンステストを実行'
                )}
              </button>

              {renderTestResults(performanceResults, 'パフォーマンス')}
            </div>
          </div>

          {/* 情報表示セクション */}
          <div className="space-y-6">
            {/* RLS設定情報 */}
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">RLS設定情報</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">🗃️ テーブル仕様</h3>
                  <ul className="space-y-1 text-gray-600">
                    <li>• テーブル名: <code className="bg-gray-100 px-1 rounded">images</code></li>
                    <li>• user_id: UUID型（必須）</li>
                    <li>• RLS: 有効化済み</li>
                    <li>• インデックス: 6個（パフォーマンス最適化）</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">🔒 セキュリティポリシー</h3>
                  <ul className="space-y-1 text-gray-600">
                    <li>• 読み込み: 自分の画像 + 公開画像</li>
                    <li>• 書き込み: 自分のuser_idでのみ作成</li>
                    <li>• 更新: 自分の画像のみ更新可能</li>
                    <li>• 削除: 自分の画像のみ削除可能</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">🛡️ 保護機能</h3>
                  <ul className="space-y-1 text-gray-600">
                    <li>• auth.uid()による自動ユーザー識別</li>
                    <li>• 403エラーによる不正アクセス拒否</li>
                    <li>• 公開フラグによる選択的共有</li>
                    <li>• メタデータとタグによる柔軟な管理</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">📊 統計関数</h3>
                  <ul className="space-y-1 text-gray-600">
                    <li>• get_user_image_count(): 画像数取得</li>
                    <li>• get_user_total_file_size(): 合計サイズ取得</li>
                    <li>• is_image_owner(): 所有者チェック</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 総合レポート生成 */}
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">総合レポート生成</h2>
              <p className="text-gray-600 text-sm mb-4">
                全テスト結果の詳細レポートを生成します
              </p>
              
              <button
                onClick={generateReport}
                disabled={isGeneratingReport}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  isGeneratingReport
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                }`}
              >
                {isGeneratingReport ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>レポート生成中...</span>
                  </div>
                ) : (
                  '総合レポートを生成'
                )}
              </button>
            </div>

            {testReport && (
              <div className="bg-white rounded-lg border shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4">テストレポート</h2>
                <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap">{testReport}</pre>
                </div>
                <div className="flex space-x-2 mt-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(testReport);
                      alert('レポートをクリップボードにコピーしました');
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors"
                  >
                    📋 レポートをコピー
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([testReport], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `images-rls-test-report-${new Date().toISOString().split('T')[0]}.md`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                  >
                    💾 ダウンロード
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SQLファイル情報 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">📋 セットアップ手順</h2>
          <p className="text-blue-800 text-sm mb-3">
            以下のSQLファイルをSupabaseのSQLエディターで実行してRLSを有効化してください：
          </p>
          <div className="bg-white rounded border p-4">
            <div className="font-semibold text-gray-900 mb-2">1. RLS設定を適用</div>
            <code className="text-blue-600 bg-gray-100 px-2 py-1 rounded">
              supabase/images-rls.sql
            </code>
            <div className="text-gray-600 text-sm mt-2">
              ✅ images テーブル作成<br/>
              ✅ Row Level Security 有効化<br/>
              ✅ セキュリティポリシー設定<br/>
              ✅ パフォーマンス最適化インデックス<br/>
              ✅ ヘルパー関数定義
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}