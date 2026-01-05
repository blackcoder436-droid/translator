const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/projects/695be2ad12a63fceb7afda01/export',
  method: 'POST',
  headers: {
    'x-skip-auth': '1'
  }
};

const req = http.request(options, (res) => {
  console.log('statusCode:', res.statusCode);
  res.setEncoding('utf8');
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('response body:', data);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('request error', e);
  process.exit(1);
});

req.end();
