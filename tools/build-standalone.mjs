// build-standalone.mjs — inline vendor/three, postprocessing, and game.js into
// index.html to produce ONE self-contained file (no external requests at all).
// Output: dist/gauntlet.html  (playable by opening directly; also artifact-ready).
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

let html = read('index.html');

function inlineScript(src) {
  const code = read(src);
  const tag = new RegExp(`<script src="${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"></script>`);
  if (!tag.test(html)) throw new Error('script tag not found for ' + src);
  // Guard against accidental </script> in code (there is none, but be safe).
  html = html.replace(tag, '<script>\n' + code.replace(/<\/script>/g, '<\\/script>') + '\n</script>');
}

inlineScript('vendor/three.min.js');
inlineScript('vendor/postprocessing.js');
inlineScript('game.js');

mkdirSync(path.join(root, 'dist'), { recursive: true });
writeFileSync(path.join(root, 'dist/gauntlet.html'), html);
console.log('WROTE dist/gauntlet.html  (' + (html.length / 1024).toFixed(0) + ' KB)');
