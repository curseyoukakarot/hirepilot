const http = require('http');
const url = require('url');

http.createServer((req, res) => {
  const query = url.parse(req.url, true).query;
  console.log('Query params:', query);
  res.end('You can close this window. You may now return to the Apollo playground.');
}).listen(5000, () => {
  console.log('Listening on port 5000');
}); 