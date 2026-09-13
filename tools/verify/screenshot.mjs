#!/usr/bin/env node
// tools/verify/screenshot.mjs — the verification loop.
//
// Loads the app in headless Chromium (Playwright, using the preinstalled
// browser at PLAYWRIGHT_BROWSERS_PATH), waits for window.__SOLAR_READY__,
// optionally sets a scene/camera/time-of-day via query params, takes a
// screenshot, and writes a JSON log (console errors, fps, draw calls).
//
// Usage:
//   node tools/verify/screenshot.mjs [--url=http://localhost:4173] \
//     [--scene=environment] [--tod=12] [--out=docs/critique/manual] \
//     [--name=manual] [--timeout=15000]
//
// No agent may claim a visual result without having run this and looked
// at the PNG it writes.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const url = args.url || 'http://localhost:4173';
const scene = args.scene || null;
const tod = args.tod ?? '12';
const outDir = args.out || 'docs/critique/manual';
const name = args.name || (scene ? `${scene}_tod${tod}` : `boot_tod${tod}`);
const timeoutMs = Number(args.timeout || 15000);

const qs = new URLSearchParams();
if (scene) qs.set('scene', scene);
qs.set('tod', tod);
const targetUrl = `${url}/?${qs.toString()}`;

const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium';

async function main() {
  const launchOpts = { headless: true };
  try {
    const { existsSync } = await import('node:fs');
    if (existsSync(executablePath)) launchOpts.executablePath = executablePath;
  } catch {
    // fall through to default resolution
  }

  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err.stack || err)));

  let loadError = null;
  try {
    await page.goto(targetUrl, { waitUntil: 'load', timeout: timeoutMs });
    await page.waitForFunction('window.__SOLAR_READY__ === true', { timeout: timeoutMs });
  } catch (err) {
    loadError = String(err.message || err);
  }

  // Sample fps over a short window by counting rAF callbacks in-page.
  let fps = null;
  if (!loadError) {
    try {
      fps = await page.evaluate(
        () =>
          new Promise((resolve) => {
            let frames = 0;
            const start = performance.now();
            function count() {
              frames++;
              const elapsed = performance.now() - start;
              if (elapsed < 1000) {
                requestAnimationFrame(count);
              } else {
                resolve(Math.round((frames * 1000) / elapsed));
              }
            }
            requestAnimationFrame(count);
          })
      );
    } catch {
      fps = null;
    }
  }

  const drawCalls = loadError
    ? null
    : await page
        .evaluate(() => window.__SOLAR_DEBUG__?.drawCalls ?? null)
        .catch(() => null);

  mkdirSync(outDir, { recursive: true });
  const pngPath = join(outDir, `${name}.png`);
  const jsonPath = join(outDir, `${name}.json`);

  if (!loadError) {
    await page.screenshot({ path: pngPath });
  }

  const log = {
    url: targetUrl,
    scene: scene || 'boot',
    timeOfDay: Number(tod),
    ready: !loadError,
    loadError,
    consoleErrors,
    consoleWarnings,
    fps,
    fpsNote:
      'Headless Chromium in this environment renders WebGL in software. fps is advisory only until measured on real hardware; draw calls and zero console errors are the hard gates.',
    drawCalls,
    timestamp: new Date().toISOString(),
  };

  writeFileSync(jsonPath, JSON.stringify(log, null, 2) + '\n');

  await browser.close();

  console.log(`[verify] ${loadError ? 'FAILED' : 'ok'} — ${name}`);
  console.log(`  png:  ${loadError ? '(not written — load failed)' : pngPath}`);
  console.log(`  json: ${jsonPath}`);
  console.log(`  consoleErrors: ${consoleErrors.length}, fps~${fps}, drawCalls: ${drawCalls}`);
  if (loadError) {
    console.error(`  loadError: ${loadError}`);
    process.exitCode = 1;
  } else if (consoleErrors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[verify] fatal error', err);
  process.exitCode = 1;
});
