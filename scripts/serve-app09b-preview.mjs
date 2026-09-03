import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const publicRoot = path.join(repoRoot, 'dist', 'browser');
const port = Number(process.env.PORT ?? 10000);

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.musicxml', 'application/vnd.recordare.musicxml+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.css', 'text/css; charset=utf-8']
]);

const resolveRequestPath = (rawUrl) => {
  const url = new URL(rawUrl ?? '/', 'http://localhost');
  const requestPath = url.pathname === '/' ? '/st-score-editor-app09b.html' : url.pathname;
  const decoded = decodeURIComponent(requestPath);
  const normalized = path.posix.normalize(decoded);
  if (!normalized.startsWith('/') || normalized.includes('..')) return null;
  const relative = normalized.slice(1);
  const absolute = path.resolve(publicRoot, relative);
  if (absolute !== publicRoot && !absolute.startsWith(`${publicRoot}${path.sep}`)) return null;
  return absolute;
};

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' });
    response.end('Method Not Allowed');
    return;
  }
  const absolute = resolveRequestPath(request.url);
  if (absolute === null) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('Bad Request');
    return;
  }
  try {
    const info = await stat(absolute);
    if (!info.isFile()) throw new Error('not file');
    response.writeHead(200, {
      'Content-Type': mime.get(path.extname(absolute).toLowerCase()) ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(absolute).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('Not Found');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`APP-09B preview server listening on ${port}`);
});
