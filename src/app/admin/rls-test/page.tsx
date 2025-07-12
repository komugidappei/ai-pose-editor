'use client';

import { useState } from 'react';
import Layout from '@/components/Layout';
import { testBasicRLS, testRLSPerformance, generateRLSTestReport } from '@/lib/rls-test';

export default function RLSTestPage() {
  const [isTestingBasic, setIsTestingBasic] = useState(false);
  const [isTestingPerformance, setIsTestingPerformance] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [basicTestResults, setBasicTestResults] = useState<any>(null);
  const [performanceTestResults, setPerformanceTestResults] = useState<any>(null);
  const [testReport, setTestReport] = useState<string>('');

  const runBasicTest = async () => {
    setIsTestingBasic(true);
    try {
      const results = await testBasicRLS();
      setBasicTestResults(results);
      console.log('Basic RLS Test Results:', results);
    } catch (error) {
      console.error('Basic test failed:', error);
      setBasicTestResults({
        success: false,
        results: [{ test: 'テスト実行', passed: false, error: error instanceof Error ? error.message : '予期しないエラー' }]
      });
    } finally {
      setIsTestingBasic(false);
    }
  };

  const runPerformanceTest = async () => {
    setIsTestingPerformance(true);
    try {
      const results = await testRLSPerformance(50);
      setPerformanceTestResults(results);
      console.log('Performance RLS Test Results:', results);
    } catch (error) {
      console.error('Performance test failed:', error);
      setPerformanceTestResults({
        success: false,
        executionTime: 0,
        error: error instanceof Error ? error.message : '予期しないエラー'
      });
    } finally {
      setIsTestingPerformance(false);
    }
  };

  const generateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const report = await generateRLSTestReport();
      setTestReport(report);
    } catch (error) {
      console.error('Report generation failed:', error);
      setTestReport('レポート生成に失敗しました: ' + (error instanceof Error ? error.message : '予期しないエラー'));
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center space-x-2">
            <span>🔒</span>
            <span>Row Level Security (RLS) テスト</span>
          </h1>
          <p className="text-gray-600">
            Supabaseのセキュリティポリシーが正しく動作することを確認します
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* テスト実行セクション */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">基本機能テスト</h2>
              <p className="text-gray-600 text-sm mb-4">
                ユーザー認証とデータアクセス制御の基本的な動作を確認します
              </p>
              
              <button
                onClick={runBasicTest}
                disabled={isTestingBasic}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  isTestingBasic
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isTestingBasic ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>テスト実行中...</span>
                  </div>
                ) : (
                  '基本テストを実行'
                )}
              </button>

              {basicTestResults && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className={`font-semibold mb-2 ${
                    basicTestResults.success ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {basicTestResults.success ? '✅ テスト成功' : '❌ テスト失敗'}
                  </div>
                  <div className="space-y-1 text-sm">
                    {basicTestResults.results.map((result: any, index: number) => (
                      <div key={index} className="flex items-start space-x-2">
                        <span>{result.passed ? '✅' : '❌'}</span>
                        <div>
                          <div>{result.test}</div>
                          {result.error && (
                            <div className="text-red-600 text-xs">{result.error}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">パフォーマンステスト</h2>
              <p className="text-gray-600 text-sm mb-4">
                大量データでのRLSポリシーの実行速度を測定します
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

              {performanceTestResults && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className={`font-semibold mb-2 ${
                    performanceTestResults.success ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {performanceTestResults.success ? '✅ テスト成功' : '❌ テスト失敗'}
                  </div>
                  <div className="text-sm space-y-1">
                    <div>実行時間: {performanceTestResults.executionTime}ms</div>
                    {performanceTestResults.error && (
                      <div className="text-red-600">エラー: {performanceTestResults.error}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

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
                  'レポートを生成'
                )}
              </button>
            </div>
          </div>

          {/* RLS設定情報 */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">RLS設定情報</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">適用済みテーブル</h3>
                  <ul className="space-y-1 text-gray-600">
                    <li>• generated_images（画像履歴）</li>
                    <li>• saved_poses（保存済みポーズ）</li>
                    <li>• user_profiles（ユーザープロファイル）</li>
                    <li>• prompt_templates（プロンプトテンプレート）</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">セキュリティポリシー</h3>
                  <ul className="space-y-1 text-gray-600">
                    <li>• 読み込み: 自分のuser_idのデータのみ</li>
                    <li>• 書き込み: 自分のuser_idでのみ作成可能</li>
                    <li>• 更新: 自分のデータのみ更新可能</li>
                    <li>• 削除: 自分のデータのみ削除可能</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">実装済み機能</h3>
                  <ul className="space-y-1 text-gray-600">
                    <li>• auth.uid()による自動ユーザー識別</li>
                    <li>• 403エラーによる不正アクセス拒否</li>
                    <li>• パフォーマンス最適化インデックス</li>
                    <li>• セキュリティヘルパー関数</li>
                  </ul>
                </div>
              </div>
            </div>

            {testReport && (
              <div className="bg-white rounded-lg border shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4">テストレポート</h2>
                <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap">{testReport}</pre>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(testReport);
                    alert('レポートをクリップボードにコピーしました');
                  }}
                  className="mt-3 px-4 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors"
                >
                  📋 レポートをコピー
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SQLファイル情報 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">📋 設定ファイル</h2>
          <p className="text-blue-800 text-sm mb-3">
            以下のSQLファイルをSupabaseのSQLエディターで実行してRLSを有効化してください：
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white rounded border p-3">
              <div className="font-semibold text-gray-900 mb-1">1. スキーマ作成</div>
              <code className="text-blue-600">supabase/schema.sql</code>
              <div className="text-gray-600 text-xs mt-1">テーブル定義とインデックス</div>
            </div>
            <div className="bg-white rounded border p-3">
              <div className="font-semibold text-gray-900 mb-1">2. RLS有効化</div>
              <code className="text-blue-600">supabase/rls-policies.sql</code>
              <div className="text-gray-600 text-xs mt-1">セキュリティポリシー設定</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}