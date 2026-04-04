const http = require('http');
http.get('http://localhost:3001/api/analytics/velocity-alerts/1', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    require('fs').writeFileSync('fetch.json', data);
    process.exit(0);
  });
}).on('error', (err) => {
  console.log('ERROR:', err.message);
  process.exit(1);
});
