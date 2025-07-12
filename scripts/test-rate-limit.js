#!/usr/bin/env node

// レート制限テストスクリプト
// API エンドポイントのレート制限が正しく動作することを確認

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function testRateLimit(endpoint, method = 'GET', maxRequests = 6) {
  console.log(`\n🧪 Testing rate limit for ${endpoint}`);
  console.log(`Making ${maxRequests} requests...`);
  
  const results = [];
  
  for (let i = 1; i <= maxRequests; i++) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: method === 'POST' ? JSON.stringify({
          prompt: 'test prompt',
          pose: [],
          style: 'realistic'
        }) : undefined
      });
      
      const headers = {
        limit: response.headers.get('X-RateLimit-Limit'),
        remaining: response.headers.get('X-RateLimit-Remaining'),
        reset: response.headers.get('X-RateLimit-Reset'),
        retryAfter: response.headers.get('Retry-After')
      };
      
      results.push({
        request: i,
        status: response.status,
        headers,
        success: response.status < 400
      });
      
      console.log(`Request ${i}: ${response.status} (remaining: ${headers.remaining})`);
      
      // 429の場合、詳細情報を表示
      if (response.status === 429) {
        const error = await response.json();
        console.log(`❌ Rate limited: ${error.error}`);
        console.log(`⏰ Retry after: ${headers.retryAfter} seconds`);
        break;
      }
      
    } catch (error) {
      console.error(`Request ${i} failed:`, error.message);
    }
    
    // 少し待機（連続リクエストを避ける）
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 結果の分析
  const successful = results.filter(r => r.success).length;
  const rateLimited = results.filter(r => r.status === 429).length;
  
  console.log(`\n📊 Results for ${endpoint}:`);
  console.log(`✅ Successful requests: ${successful}`);
  console.log(`🚫 Rate limited requests: ${rateLimited}`);
  
  if (rateLimited > 0) {
    console.log(`✅ Rate limiting is working correctly!`);
  } else {
    console.log(`⚠️  No rate limiting detected (may need more requests)`);
  }
  
  return results;
}

async function testAllEndpoints() {
  console.log('🚀 Starting rate limit tests...');
  console.log(`Testing against: ${API_BASE}`);
  
  // テスト対象のエンドポイント
  const endpoints = [
    { path: '/api/generate', method: 'GET' },
    { path: '/api/pose', method: 'GET' },
    { path: '/api/generate-secure', method: 'GET' }
  ];
  
  for (const endpoint of endpoints) {
    await testRateLimit(endpoint.path, endpoint.method);
    
    // エンドポイント間で少し待機
    console.log('\n⏸️  Waiting 2 seconds before next test...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🎉 All rate limit tests completed!');
  console.log('\n💡 Tips:');
  console.log('- Rate limits reset every minute');
  console.log('- Check browser console for detailed error messages');
  console.log('- Use different IP addresses to test concurrent limits');
}

// メイン実行
if (require.main === module) {
  testAllEndpoints().catch(console.error);
}

module.exports = { testRateLimit, testAllEndpoints };