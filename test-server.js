import http from 'http';

http.get('http://localhost:3000/api/auth/url', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, data));
}).on('error', (err) => console.error('Error:', err.message));
