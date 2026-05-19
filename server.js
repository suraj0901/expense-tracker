/**
 * Production server — serves dist/ with cross-origin isolation headers.
 *
 * Required for OPFS-based persistence (SQLite via SQLocal).
 * Without these headers, data is stored in-memory and lost on refresh.
 *
 * Usage: node server.js
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist');
const PORT = process.env.PORT || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const COOP = 'same-origin';
const COEP = 'credentialless';

createServer(async (req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', COOP);
  res.setHeader('Cross-Origin-Embedder-Policy', COEP);

  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = join(DIST, url.pathname);

  // SPA fallback: serve index.html for non-file routes
  if (!extname(filePath) || !existsSync(filePath)) {
    filePath = join(DIST, 'index.html');
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.writeHead(200);
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}).listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Cross-origin isolation headers: enabled');
});
