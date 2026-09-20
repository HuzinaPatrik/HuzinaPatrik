// Local preview: renders ../README.md with GitHub's own markdown API (via the gh CLI) and wraps it
// in a page that mimics the profile README box (measured on github.com: 846px of content at 14px/21px
// on a desktop, 308px on a 390px phone). Writes ../.preview/<theme>.html and mobile-<theme>.html for dark, light, dimmed and dark-high-contrast.
// Usage: npm run preview   (requires an authenticated `gh`)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, '.preview');
mkdirSync(out, { recursive: true });

import { assetBase } from './content.mjs';

// the README points at the pushed files; the preview should show the local ones
const html = execFileSync('gh', ['api', 'markdown', '-F', `text=@${join(root, 'README.md')}`, '-f', 'mode=gfm'], { encoding: 'utf8', maxBuffer: 1 << 26 })
  .replaceAll(assetBase, 'assets');

// GitHub picks the <source> that matches the viewer's theme; emulate that choice statically.
function resolvePictures(markup, { dark, mobile }) {
  return markup.replace(/<picture>([\s\S]*?)<\/picture>/g, (_, inner) => {
    const img = inner.match(/<img[^>]*>/)[0];
    const sources = [...inner.matchAll(/<source[^>]*media="([^"]*)"[^>]*srcset="([^"]*)"[^>]*>/g)].map((m) => ({ media: m[1], src: m[2] }));
    // the first source whose width and colour-scheme conditions both hold wins, as in a browser
    const match = sources.find((s) =>
      (!s.media.includes('max-width') || mobile) && (!s.media.includes('min-width') || !mobile) &&
      (!s.media.includes('light') || !dark) && (!s.media.includes('dark') || dark));
    return match ? img.replace(/src="[^"]*"/, `src="${match.src}"`) : img;
  });
}

// Page colours of GitHub's themes. Dimmed and high contrast reuse the dark assets, so they are here to
// check that the elements without a panel of their own (headings, footer) still read on those canvases.
const palette = {
  dark: { assets: 'dark', bg: '#0d1117', fg: '#e6edf3', border: '#30363d', link: '#4493f8', row: '#161b22' },
  light: { assets: 'light', bg: '#ffffff', fg: '#1f2328', border: '#d0d7de', link: '#0969da', row: '#f6f8fa' },
  dimmed: { assets: 'dark', bg: '#22272e', fg: '#adbac7', border: '#444c56', link: '#539bf5', row: '#2d333b' },
  'dark-high-contrast': { assets: 'dark', bg: '#010409', fg: '#ffffff', border: '#b7bdc8', link: '#74b9ff', row: '#151b23' },
};

for (const theme of Object.keys(palette)) {
  for (const mobile of [false, true]) {
    const c = palette[theme];
    const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<base href="${pathToFileURL(root).href}/">
<style>
  body{margin:0;background:${c.bg};color:${c.fg};font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif}
  .box{box-sizing:border-box;width:${mobile ? '390px' : '896px'};margin:${mobile ? '0' : '24px auto'};padding:${mobile ? '16px 41px' : '24px'};border:${mobile ? '0' : `1px solid ${c.border}`};border-radius:6px}
  img{max-width:100%;height:auto;box-sizing:content-box;border-style:none}
  p{margin:0 0 16px} a{color:${c.link};text-decoration:none}
  details{margin-bottom:16px} summary{cursor:pointer}
  table{border-collapse:collapse;display:block;width:max-content;max-width:100%;overflow:auto;margin-bottom:16px}
  th,td{padding:6px 13px;border:1px solid ${c.border}} tr:nth-child(2n){background:${c.row}}
</style></head><body><div class="box">${resolvePictures(html, { dark: c.assets === 'dark', mobile })}</div></body></html>`;
    writeFileSync(join(out, `${mobile ? 'mobile-' : ''}${theme}.html`), page);
  }
}
console.log('preview written to .preview/');
