import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';

const browserRoot = path.join(
  path.resolve(fileURLToPath(new URL('../..', import.meta.url))),
  'dist',
  'browser'
);

const mime = Object.freeze({
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8'
});

export const openMobileWebKitArtifact = async ({
  htmlFile,
  scriptFile,
  portErrorCode
}) => {
  const routes = new Map([
    ['/', { file: htmlFile, type: mime.html }],
    [`/${htmlFile}`, { file: htmlFile, type: mime.html }],
    [`/${scriptFile}`, { file: scriptFile, type: mime.js }]
  ]);

  const server = createServer((request, response) => {
    const pathname = (request.url ?? '/').split('?', 1)[0];
    const asset = routes.get(pathname);
    if (asset === undefined) {
      response.writeHead(404).end('not found');
      return;
    }
    readFile(path.join(browserRoot, asset.file))
      .then(bytes => {
        response.setHeader('Content-Type', asset.type);
        response.setHeader('Cache-Control', 'no-store');
        response.end(bytes);
      })
      .catch(() => response.writeHead(404).end('not found'));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    throw new Error(portErrorCode);
  }

  let browser;
  try {
    browser = await webkit.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: true
    });
    const page = await context.newPage();
    const errors = [];
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}/${htmlFile}`, {
      waitUntil: 'load',
      timeout: 30000
    });
    return Object.freeze({
      page,
      errors,
      close: async () => {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
      }
    });
  } catch (error) {
    if (browser !== undefined) await browser.close();
    await new Promise(resolve => server.close(resolve));
    throw error;
  }
};
