// Local dev server — mimics Vercel: serves the static site + runs /api/*.js
// functions with a minimal (req,res) shim. Dev/testing only; not deployed.
//   node tools/dev-server.js [port]
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.join(__dirname, '..');
const PORT = parseInt(process.argv[2], 10) || 5050;

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4',
};

function decorate(req, res, parsed) {
  req.query = parsed.query || {};
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
  res.send = (s) => { res.end(s); return res; };
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsed.pathname);

  // API routes
  if (pathname.startsWith('/api/')) {
    const name = pathname.slice('/api/'.length).replace(/\/$/, '');
    const file = path.join(ROOT, 'api', name + '.js');
    decorate(req, res, parsed);
    try {
      delete require.cache[require.resolve(file)]; // hot-reload each request
      const handler = require(file);
      await handler(req, res);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'dev-server: ' + String(err.message || err) }));
    }
    return;
  }

  // Static files
  if (pathname === '/') pathname = '/index.html';
  let filePath = path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) { res.statusCode = 403; return res.end('Forbidden'); }
  fs.stat(filePath, (err, stat) => {
    if (err || stat.isDirectory()) {
      // try .html fallback
      const alt = filePath + '.html';
      if (fs.existsSync(alt)) return stream(alt, res);
      res.statusCode = 404; return res.end('Not found: ' + pathname);
    }
    stream(filePath, res);
  });
});

function stream(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
}

server.listen(PORT, () => {
  console.log(`dev-server on http://localhost:${PORT}  (PAYMENTS_MODE=${process.env.PAYMENTS_MODE}, BOOKING_MODE=${process.env.BOOKING_MODE})`);
});
