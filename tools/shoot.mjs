// shoot.mjs — headless screenshot tool for blind critics.
// Usage: node tools/shoot.mjs <url-or-file> <outfile.png> [waitMs] [actions]
// Loads the page, waits, optionally drives the game (click to lock, move, shoot),
// and writes a PNG. Used so an independent critic can inspect the REAL pixels.
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';
import path from 'path';

// Use the headless-shell binary: this Chromium removed legacy --headless=old that
// the full chrome binary rejects. headless_shell is the standalone old-headless impl.
const EXECUTABLE = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const target = process.argv[2] || 'index.html';
const out = process.argv[3] || 'shots/shot.png';
const waitMs = parseInt(process.argv[4] || '2500', 10);
const actions = (process.argv[5] || 'start,shoot').split(',').map(s => s.trim());

const url = target.startsWith('http') || target.startsWith('file:')
  ? target
  : 'file://' + path.resolve(target);

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[PAGEERROR] ${e.message}`));

await page.goto(url, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(600);

const W = 1280, H = 720, cx = W / 2, cy = H / 2;

async function tap(sel) {
  try { const el = await page.$(sel); if (el) { await el.click({ timeout: 800 }); return true; } } catch {}
  return false;
}

for (const a of actions) {
  if (a === 'start') {
    // Start via the exposed hook (pointer lock is unreliable in headless), then click canvas.
    await tap('#startBtn');
    await page.evaluate(() => { try { window.__GAUNTLET && window.__GAUNTLET.autostart(); } catch (e) {} });
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(500);
  } else if (a === 'state') {
    const s = await page.evaluate(() => window.__GAUNTLET && window.__GAUNTLET.state());
    logs.push('[STATE] ' + JSON.stringify(s));
  } else if (a === 'aim') {
    await page.evaluate(() => window.__GAUNTLET && window.__GAUNTLET.aimNearest());
  } else if (a.startsWith('pitch')) {
    const p = parseFloat(a.slice(5) || '0');
    await page.evaluate((pp) => window.__GAUNTLET && window.__GAUNTLET.setPitch(pp), p);
  } else if (a === 'gunfire') {
    for (let i = 0; i < 4; i++) { await page.evaluate(() => window.__GAUNTLET && window.__GAUNTLET.fireOnce()); await page.waitForTimeout(90); }
  } else if (a === 'move') {
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyW');
  } else if (a === 'look') {
    await page.mouse.move(cx, cy);
    await page.mouse.move(cx + 220, cy + 30, { steps: 12 });
  } else if (a === 'shoot') {
    for (let i = 0; i < 3; i++) { await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up(); await page.waitForTimeout(120); }
  } else if (a.startsWith('wait')) {
    await page.waitForTimeout(parseInt(a.slice(4) || '500', 10));
  }
}

await page.waitForTimeout(waitMs);
await page.screenshot({ path: out });
await browser.close();

console.log('WROTE ' + out);
if (logs.length) console.log('--- console/errors ---\n' + logs.slice(-40).join('\n'));
