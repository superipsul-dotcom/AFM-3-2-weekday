// server.js — dependency-free Node.js backend (run with: node server.js)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Small pool of Korean greetings so repeated calls feel alive
const GREETINGS = ['안녕하세요!', '반가워요!', '좋은 하루예요!'];

// Static file MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function serveStatic(req, res) {
  // Default to index.html at root
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  // Prevent path traversal
  const safePath = path
    .normalize(urlPath)
    .replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // CORS preflight for the API
  if (req.method === 'OPTIONS' && urlPath.startsWith('/api/')) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // GET /api/hello
  if (req.method === 'GET' && urlPath === '/api/hello') {
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    const time = new Date().toLocaleString('ko-KR');
    sendJson(res, 200, { greeting, time });
    return;
  }

  // Static files (only GET)
  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  // Anything else
  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('405 Method Not Allowed');
});

server.listen(PORT, () => {
  console.log('================================================');
  console.log('  서버가 실행 중입니다!');
  console.log(`  서버 주소:   http://localhost:${PORT}`);
  console.log(`  API 엔드포인트: http://localhost:${PORT}/api/hello`);
  console.log('  종료하려면 Ctrl+C 를 누르세요.');
  console.log('================================================');
});
