// build-showcase.mjs — inline compressed JPEGs into the showcase template so the
// published artifact is fully self-contained (no external image hosts).
// Uses headless Chromium's canvas to downscale + re-encode each PNG.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const EXE = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const imgs = {
  HERO: 'docs/hero.png', BASE_SCENE: 'docs/baseline_scene.png', R2_SCENE: 'docs/round2_spitter.png',
  BASE_ENEMY: 'docs/baseline_enemy.png', DRONE: 'docs/round2_drone.png',
  SPITTER: 'docs/round2_spitter.png', BRUTE: 'docs/round2_brute.png', MENU: 'docs/round2_menu.png',
};

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

async function encode(file, w, q) {
  const src = 'data:image/png;base64,' + readFileSync(path.join(root, file)).toString('base64');
  return page.evaluate(async ({ src, w, q }) => {
    const img = new Image(); img.src = src; await img.decode();
    const scale = Math.min(1, w / img.width);
    const cw = Math.round(img.width * scale), ch = Math.round(img.height * scale);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    c.getContext('2d').drawImage(img, 0, 0, cw, ch);
    return c.toDataURL('image/jpeg', q);
  }, { src, w, q });
}

let tpl = readFileSync(path.join(root, 'docs/showcase.tpl.html'), 'utf8');
let total = 0;
for (const [k, f] of Object.entries(imgs)) {
  const w = k === 'HERO' ? 1120 : 900;
  const dataUrl = await encode(f, w, 0.82);
  tpl = tpl.replaceAll('{{' + k + '}}', dataUrl);
  total += dataUrl.length;
  console.log(k.padEnd(11), (dataUrl.length / 1024).toFixed(0) + ' KB');
}
await browser.close();
writeFileSync(path.join(root, 'docs/showcase.html'), tpl);
console.log('WROTE docs/showcase.html  (' + (tpl.length / 1024).toFixed(0) + ' KB total)');
