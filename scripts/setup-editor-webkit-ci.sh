#!/usr/bin/env bash
set -euo pipefail

npm install --ignore-scripts --no-audit --no-fund --no-package-lock
npm run install:verified-audio -- --with-playwright
node node_modules/playwright/cli.js install --with-deps webkit
