'use client';

import { useUsage } from '@/components/UsageContext';
import Layout from '@/components/Layout';

interface UsageLimitProps {
  title: string;
  current: number;
  limit: number;
  color: string;
  unit?: string;
}

function UsageCard({ title, current, limit, color, unit = "回" }: UsageLimitProps) {
  const percentage = (current / limit) * 100;
  
  return (
    <div className="bg-white rounded-lg border shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
          1日{limit}{unit}
        </span>
      </div>
      
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-3xl font-bold text-gray-900">{current}</span>
          <span className="text-sm text-gray-500">/ {limit} {unit}</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ease-out ${color}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          ></div>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          残り {limit - current} {unit}
        </span>
        <span className={`font-medium ${
          percentage >= 80 ? 'text-red-500' : 
          percentage >= 60 ? 'text-yellow-500' : 
          'text-green-500'
        }`}>
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { usage, limits } = useUsage();
  
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          {/* ヘッダー */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">無料プラン ダッシュボード</h1>
            <p className="text-gray-600 text-lg">今日の使用状況を確認しましょう</p>
          </div>
          
          {/* 使用状況カード */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <UsageCard 
              title="画像生成" 
              current={usage.imageGeneration} 
              limit={limits.imageGeneration} 
              color="bg-gradient-to-r from-blue-500 to-blue-600" 
            />
            <UsageCard 
              title="ポーズ抽出" 
              current={usage.poseExtraction} 
              limit={limits.poseExtraction} 
              color="bg-gradient-to-r from-green-500 to-green-600" 
            />
            <UsageCard 
              title="商用利用" 
              current={usage.commercialUse} 
              limit={limits.commercialUse} 
              color="bg-gradient-to-r from-purple-500 to-purple-600" 
              unit="枚"
            />
          </div>
          
          {/* メインコンテンツエリア */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 最近の作品 */}
            <div className="lg:col-span-2 bg-white rounded-lg border shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">最近の作品</h2>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  すべて見る
                </button>
              </div>
              
              <div className="space-y-4">
                {[
                  { id: 1, name: "ポートレート作品", time: "2時間前", status: "完成" },
                  { id: 2, name: "アクションポーズ", time: "5時間前", status: "編集中" },
                  { id: 3, name: "ダンスポーズ", time: "1日前", status: "完成" }
                ].map((work) => (
                  <div key={work.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{work.name}</h3>
                      <p className="text-sm text-gray-600">{work.time}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        work.status === '完成' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {work.status}
                      </span>
                      <button className="text-blue-600 hover:text-blue-700 font-medium">編集</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* サイドバー */}
            <div className="space-y-6">
              {/* プランの詳細 */}
              <div className="bg-white rounded-lg border shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">現在のプラン</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">プラン</span>
                    <span className="font-medium">無料プラン</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">解像度</span>
                    <span className="font-medium">512px</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">保存スロット</span>
                    <span className="font-medium">{usage.saveSlots}/{limits.saveSlots}個</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">広告</span>
                    <span className="font-medium text-yellow-600">あり</span>
                  </div>
                </div>
              </div>
              
              {/* 使用のヒント */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 使用のヒント</h3>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li>• 毎日午前0時にカウントがリセットされます</li>
                  <li>• 商用利用は高品質な画像を生成します</li>
                  <li>• ポーズ抽出は複雑な画像ほど精度が向上します</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* 右下の有料プランボタン */}
          <div className="fixed bottom-6 right-6 z-50">
            <button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2 group">
              <span className="font-semibold">有料プランを見る</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}