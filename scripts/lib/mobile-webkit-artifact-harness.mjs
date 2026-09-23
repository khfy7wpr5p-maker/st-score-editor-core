import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { webkit } from 'playwright';

const browserRoot = path.join(
  path.resolve(fileURLToPath(new URL('../..', import.meta.url))),
  'dist',
  'browser'
);

export const openMobileWebKitArtifact = async ({
  htmlFile,
  scriptFile,
  portErrorCode: _unusedPortErrorCode
}) => {
  const htmlPath = path.join(browserRoot, htmlFile);
  const scriptPath = path.join(browserRoot, scriptFile);

  await Promise.all([
    readFile(htmlPath),
    readFile(scriptPath)
  ]);

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

    await page.goto(pathToFileURL(htmlPath).href, {
      waitUntil: 'load',
      timeout: 30000
    });

    return Object.freeze({
      page,
      errors,
      close: async () => {
        await browser.close();
      }
    });
  } catch (error) {
    if (browser !== undefined) await browser.close();
    throw error;
  }
};