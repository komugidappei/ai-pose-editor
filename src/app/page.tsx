import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            AI画像生成×ポーズ編集
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            3Dポーズエディターで理想のポーズを作成し、AIで高品質な画像を生成
          </p>
          <div className="flex gap-4 justify-center">
            <Link 
              href="/upload"
              className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              始める
            </Link>
            <Link 
              href="/dashboard"
              className="bg-white hover:bg-gray-50 text-gray-800 px-8 py-3 rounded-lg font-semibold border border-gray-300 transition-colors"
            >
              ダッシュボード
            </Link>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">1. 画像をアップロード</h3>
            <p className="text-gray-600">参考にしたい画像をアップロードして、ポーズを自動抽出します</p>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 100-4H7a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">2. ポーズを編集</h3>
            <p className="text-gray-600">3Dエディターで関節をドラッグして、理想のポーズに調整します</p>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">3. AI画像生成</h3>
            <p className="text-gray-600">編集したポーズを基に、AIが高品質な画像を生成します</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-center mb-6">無料プランの特徴</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">10回/日</div>
              <div className="text-sm text-gray-600">画像生成</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">5回/日</div>
              <div className="text-sm text-gray-600">ポーズ抽出</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">3個</div>
              <div className="text-sm text-gray-600">保存スロット</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">512px</div>
              <div className="text-sm text-gray-600">解像度</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
