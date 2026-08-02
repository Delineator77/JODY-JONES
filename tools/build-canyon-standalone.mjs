// build-canyon-standalone.mjs — inline vendor/three, postprocessing, and canyon.js
// into canyon.html to produce ONE self-contained file (no external requests).
// Output: dist/canyon.html (playable by opening directly) and
//         dist/canyon.artifact.html (inner-content only, for embedding).
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

let html = read('canyon.html');

function inlineScript(src) {
  const code = read(src);
  const tag = new RegExp(`<script src="${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"></script>`);
  if (!tag.test(html)) throw new Error('script tag not found for ' + src);
  html = html.replace(tag, '<script>\n' + code.replace(/<\/script>/g, '<\\/script>') + '\n</script>');
}

inlineScript('vendor/three.min.js');
inlineScript('vendor/postprocessing.js');
inlineScript('canyon.js');

mkdirSync(path.join(root, 'dist'), { recursive: true });
writeFileSync(path.join(root, 'dist/canyon.html'), html);
console.log('WROTE dist/canyon.html  (' + (html.length / 1024).toFixed(0) + ' KB)');

// Artifact-flavored variant: inner content only (no doctype/html/head/body),
// since the embedding host wraps it in its own document skeleton. The steer-mode
// fallback in canyon.js keeps it playable where the host iframe blocks pointer lock.
const s = html.indexOf('<style>');
const e = html.indexOf('</body>');
if (s < 0 || e < 0) throw new Error('could not find <style>/</body> markers');
const inner = html.slice(s, e).replace('</style>\n</head>\n<body>', '</style>');
writeFileSync(path.join(root, 'dist/canyon.artifact.html'), inner);
console.log('WROTE dist/canyon.artifact.html  (' + (inner.length / 1024).toFixed(0) + ' KB)');
