import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = path.join(repoRoot, 'dist', 'browser');
const port = Number.parseInt(process.env.PORT ?? '10000', 10);

const mimeByExtension = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.musicxml': 'application/vnd.recordare.musicxml+xml; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
});

const resolveRequestPath = (requestUrl) => {
  const url = new URL(requestUrl ?? '/', 'http://localhost');
  if (url.pathname === '/') return path.join(root, 'st-score-editor-app09b.html');
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  const rootPrefix = `${root}${path.sep}`;
  return resolved === root || resolved.startsWith(rootPrefix) ? resolved : null;
};

const server = http.createServer(async (request, response) => {
  const target = resolveRequestPath(request.url);
  if (target === null) {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }

  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error('NOT_FILE');
    response.writeHead(200, {
      'content-type': mimeByExtension[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    });
    createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`P05 physical teacher preview serving dist/browser on port ${port}.`);
});
