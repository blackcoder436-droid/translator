const axios = require('axios');

(async () => {
  try {
    const response = await axios.post('http://localhost:5001/api/extract-cloud-srt', 
      { fileId: 'test123', language: 'auto' },
      { headers: { Authorization: 'Bearer test' } }
    );
    console.log('✅ Endpoint works!');
    console.log('Response:', response.data);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.log('❌ Backend not running on 5001');
    } else if (err.response?.status === 404) {
      console.log('❌ Endpoint not found (404)');
      console.log('Available routes:', err.config?.url);
    } else if (err.response?.status === 401) {
      console.log('⚠️  Endpoint exists but auth failed (expected)');
    } else {
      console.log('Error:', err.message);
      if (err.response?.status) console.log('Status:', err.response.status);
    }
  }
})();
