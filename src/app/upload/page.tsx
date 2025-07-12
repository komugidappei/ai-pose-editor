import Layout from '@/components/Layout';

export default function UploadPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">画像アップロード</h1>
        <div className="max-w-2xl mx-auto">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-gray-600 mb-4">画像をドラッグ&ドロップまたはクリックしてアップロード</p>
            <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors">
              ファイルを選択
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}