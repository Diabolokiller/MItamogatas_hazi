// server.js - Main backend server serving API and static frontend

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultDb } from './src/db.js';
import { createRouter } from './src/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SRC_DIR = path.join(__dirname, 'src');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const router = createRouter(defaultDb);

export function createServer(db = defaultDb) {
  const customRouter = createRouter(db);

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // Route API requests
    if (pathname.startsWith('/api/')) {
      let bodyData = '';
      req.on('data', chunk => {
        bodyData += chunk;
      });

      req.on('end', async () => {
        let parsedBody = null;
        if (bodyData) {
          try {
            parsedBody = JSON.parse(bodyData);
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Érvénytelen JSON formátum.' }));
          }
        }
        await customRouter.handleRequest(req, res, parsedBody);
      });
      return;
    }

    // Allow importing from /src/ in the browser
    if (pathname.startsWith('/src/')) {
      const filePath = path.join(__dirname, pathname);
      serveStaticFile(filePath, res);
      return;
    }

    // Route static files from /public
    let relativePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.join(PUBLIC_DIR, relativePath);

    // Prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Access denied');
    }

    serveStaticFile(filePath, res);
  });
}

function serveStaticFile(filePath, res) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// Start server if run directly
if (process.argv[1] === __filename) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🏭 Factory Forge Server fut a következő címen:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`=========================================`);
  });
}
