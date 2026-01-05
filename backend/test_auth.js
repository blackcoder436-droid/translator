const http = require('http');

http.get('http://localhost:5001/auth/google', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Response body (first 500 chars):', data.substring(0, 500));
    process.exit(0);
  });
}).on('error', (e) => {
  console.error('Request Error:', e.message);
  process.exit(1);
});
