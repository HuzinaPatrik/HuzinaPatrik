// Builds every SVG in ../assets and refreshes the generated blocks of ../README.md.
// Text is converted to outlines with opentype.js, so the typography is identical on every
// OS and inside GitHub's <img> sandbox (which blocks web fonts). Usage: npm run build
import opentype from 'opentype.js';
import { optimize } from 'svgo';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { profile, assetBase, themes, disciplines, footerLine, footerLineShort } from './content.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const loadFont = (file) => opentype.loadSync(join(here, 'fonts', file));

const FONTS = {
  display: loadFont('ArchivoExp-800.ttf'),
  heading: loadFont('ArchivoExp-700.ttf'),
  title: loadFont('Archivo-600.ttf'),
  body: loadFont('Archivo-500.ttf'),
  regular: loadFont('Archivo-400.ttf'),
  mono: loadFont('JetBrainsMono-500.ttf'),
};

// ───────────────────────────── primitives ─────────────────────────────

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const n = (v) => +v.toFixed(2);
const mix = (a, b, amount) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount).toString(16).padStart(2, '0')).join('');

function layout(fontKey, str, size, tracking = 0) {
  const font = FONTS[fontKey];
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(str);
  const placed = [];
  let x = 0;
  glyphs.forEach((glyph, i) => {
    placed.push({ glyph, x });
    x += (glyph.advanceWidth || 0) * scale;
    if (i < glyphs.length - 1) x += font.getKerningValue(glyph, glyphs[i + 1]) * scale + tracking;
  });
  return { placed, width: x };
}

const measure = (fontKey, str, size, tracking = 0) => layout(fontKey, str, size, tracking).width;

// Every distinct glyph outline is written once per file (<defs>) and placed with <use>,
// which keeps a card at roughly a third of the size of naively outlined text.
let glyphDefs = new Map();
function glyphRef(fontKey, size, glyph) {
  const key = `${fontKey}|${size}|${glyph.index}`;
  if (!glyphDefs.has(key)) {
    const d = glyph.getPath(0, 0, size).toPathData(2);
    glyphDefs.set(key, { id: `g${glyphDefs.size.toString(36)}`, d });
  }
  return glyphDefs.get(key);
}

/** Returns outlined text. anchor: start | middle | end */
function text(fontKey, str, x, y, size, { fill, tracking = 0, anchor = 'start' } = {}) {
  const { placed, width } = layout(fontKey, str, size, tracking);
  const x0 = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x;
  let uses = '';
  for (const { glyph, x: gx } of placed) {
    const ref = glyphRef(fontKey, size, glyph);
    if (ref.d) uses += `<use href="#${ref.id}" x="${n(gx)}"/>`;
  }
  return { svg: `<g transform="translate(${n(x0)} ${n(y)})" fill="${fill}">${uses}</g>`, width, x0 };
}

/** A run of differently coloured segments on one baseline. */
function textRun(fontKey, segments, x, y, size) {
  let cursor = x;
  let svg = '';
  for (const seg of segments) {
    const t = text(fontKey, seg.text, cursor, y, size, { fill: seg.fill });
    svg += t.svg;
    // keep the advance of trailing spaces, which have no outline
    cursor += t.width;
  }
  return { svg, width: cursor - x };
}

const iconCache = new Map();
function icon(name, x, y, size, color, stroke = 1.7) {
  if (!iconCache.has(name)) {
    const raw = readFileSync(join(here, 'node_modules/lucide-static/icons', `${name}.svg`), 'utf8');
    iconCache.set(name, raw.replace(/<!--[\s\S]*?-->/g, '').replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/\s*\n\s*/g, ''));
  }
  const s = size / 24;
  return `<g transform="translate(${n(x)} ${n(y)}) scale(${n(s)})" fill="none" stroke="${color}" stroke-width="${n(stroke / s)}" stroke-linecap="round" stroke-linejoin="round">${iconCache.get(name)}</g>`;
}

function doc({ w, h, label, style = '', defs = '', body }) {
  const glyphs = [...glyphDefs.values()].filter((g) => g.d).map((g) => `<path id="${g.id}" d="${g.d}"/>`).join('');
  glyphDefs = new Map();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${style ? `<style>${style}</style>` : ''}<defs>${defs}${glyphs}</defs>${body}</svg>`;
}

const REDUCED = '@media (prefers-reduced-motion:reduce){*{animation:none!important}.pulse,.flash{display:none}}';

// ───────────────────────────── skill card ─────────────────────────────

// mx/my: transparent margin baked into every card. Inline images already get ~7px of line
// spacing below them on GitHub, so the vertical margin is smaller to keep the gutters even.
const CARD = { w: 400, mx: 6, my: 3, pad: 18, tile: 34, chipH: 26, chipGap: 7, rowGap: 8, chipSize: 12, chipPadX: 10 };

function chipRows(chips) {
  const maxWidth = CARD.w - 2 * (CARD.mx + CARD.pad);
  const rows = [[]];
  let x = 0;
  for (const label of chips) {
    const w = Math.ceil(measure('mono', label, CARD.chipSize)) + CARD.chipPadX * 2;
    if (x > 0 && x + w > maxWidth) {
      rows.push([]);
      x = 0;
    }
    rows.at(-1).push({ label, w, x });
    x += w + CARD.chipGap;
  }
  return rows;
}

const chipsTop = CARD.my + CARD.pad + CARD.tile + 16;
const cardHeight = (rowCount) => chipsTop + rowCount * CARD.chipH + (rowCount - 1) * CARD.rowGap + 20 + CARD.my;

function card(themeName, disc, c, rowCount, index) {
  const t = themes[themeName];
  const tone = t.tones[disc.id];
  const h = cardHeight(rowCount);
  const left = CARD.mx + CARD.pad;
  const right = CARD.w - CARD.mx - CARD.pad;
  const top = CARD.my + CARD.pad;
  const textX = left + CARD.tile + 12;

  const title = text('title', c.title, textX, top + 14.5, 15.5, { fill: t.text });
  const blurb = text('regular', c.blurb, textX, top + 31, 12, { fill: t.text2 });
  const room = right - 18 - textX;
  if (Math.max(title.width, blurb.width) > room) console.warn(`! header text too wide in card "${c.id}" (${Math.round(Math.max(title.width, blurb.width))} > ${room})`);

  let chips = '';
  chipRows(c.chips).forEach((row, r) => {
    const y = chipsTop + r * (CARD.chipH + CARD.rowGap);
    for (const chip of row) {
      chips += `<rect x="${left + chip.x + 0.5}" y="${y + 0.5}" width="${chip.w - 1}" height="${CARD.chipH - 1}" rx="8" fill="${t.chip}" stroke="${t.chipBorder}"/>`;
      chips += text('mono', chip.label, left + chip.x + CARD.chipPadX, y + 17.3, CARD.chipSize, { fill: t.chipText }).svg;
    }
  });

  const ledX = right - 4;
  const ledY = top + CARD.tile / 2;
  const delay = (0.25 + index * 0.12).toFixed(2);
  const body =
    `<rect x="${CARD.mx + 0.5}" y="${CARD.my + 0.5}" width="${CARD.w - 2 * CARD.mx - 1}" height="${h - 2 * CARD.my - 1}" rx="14" fill="url(#face)" stroke="${t.border}"/>` +
    (themeName === 'dark' ? `<path d="M${CARD.mx + 16} ${CARD.my + 1.5}H${CARD.w - CARD.mx - 16}" stroke="${t.sheen}" stroke-opacity=".05"/>` : '') +
    `<path d="M${left + 4} ${CARD.my + 0.5}h30" stroke="${tone}" stroke-width="2" stroke-linecap="round"/>` +
    `<rect x="${left}" y="${top}" width="${CARD.tile}" height="${CARD.tile}" rx="10" fill="${tone}" fill-opacity="${t.tile}"/>` +
    icon(c.icon, left + 8, top + 8, 18, tone) +
    title.svg + blurb.svg +
    `<circle class="led" style="animation-delay:${delay}s" cx="${ledX}" cy="${ledY}" r="8" fill="${tone}" fill-opacity=".16"/>` +
    `<circle class="led" style="animation-delay:${delay}s" cx="${ledX}" cy="${ledY}" r="3.2" fill="${tone}"/>` +
    chips;

  return doc({
    w: CARD.w, h,
    label: `${c.title}: ${c.chips.join(', ')}`,
    // one power-on blink per LED, staggered across the grid; the resting state is "lit", so renderers
    // that never run the animation still show a lit LED
    style: `.led{animation:blink 1.1s ease-in-out 1}@keyframes blink{35%{opacity:.12}}${REDUCED}`,
    defs: `<linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.faceTop}"/><stop offset="1" stop-color="${t.faceBottom}"/></linearGradient>`,
    body,
  });
}

// ───────────────────────────── section heading ─────────────────────────────

// Wide and narrow layouts live in the same file. A media query inside an SVG is evaluated against
// the rendered size of the <img>, so the compact layout takes over by itself on a phone.
// (Doing this with <picture> width sources instead is fragile on GitHub, see picture() below. A width
// query inside the SVG is fine; a prefers-color-scheme query inside it is not, Safari ignores those.)
const RESPONSIVE = '.narrow{display:none}@media (max-width:520px){.wide{display:none}.narrow{display:inline}}';

function heading(themeName, disc) {
  const t = themes[themeName];
  const tone = t.tones[disc.id];
  const w = 800, h = 62;
  const node = (y, lineEnd, cx, ring, core, stroke) =>
    `<path d="M6 ${y}H${lineEnd}" stroke="${tone}" stroke-width="${stroke}" stroke-linecap="round"/>` +
    `<circle cx="${cx}" cy="${y}" r="${ring}" fill="none" stroke="${tone}" stroke-opacity=".35" stroke-width="${n(stroke * 0.75)}"/>` +
    `<circle cx="${cx}" cy="${y}" r="${core}" fill="${tone}"/>`;

  const title = text('heading', disc.title, 60, 48, 23, { fill: t.text, tracking: -0.3 });
  const blurb = text('regular', disc.blurb, w - 6, 46, 14.5, { fill: t.text2, anchor: 'end' });
  const rule = `<path d="M${n(60 + title.width + 18)} 40H${n(blurb.x0 - 18)}" stroke="${t.rule}" stroke-opacity="${t.ruleOpacity}"/>`;
  const wide = node(40, 30, 38, 9.5, 4.5, 2) + title.svg + rule + blurb.svg;

  // drawn about twice as large, because on a phone the image is shown at under half its size
  const bigTitle = text('heading', disc.title, 108, 49, 41, { fill: t.text, tracking: -0.6 });
  if (108 + bigTitle.width > w - 6) console.warn(`! narrow heading too wide: "${disc.title}"`);
  const narrow = node(34, 50, 68, 18, 8.5, 4) + bigTitle.svg;

  return doc({ w, h, label: `${disc.title}. ${disc.blurb}`, style: RESPONSIVE, body: `<g class="wide">${wide}</g><g class="narrow">${narrow}</g>` });
}

// ───────────────────────────── hero ─────────────────────────────

function heroParts(themeName, mobile = false) {
  const t = themes[themeName];
  const w = mobile ? 400 : 800;
  const h = mobile ? 372 : 324;
  const m = 6;
  const padX = mobile ? 28 : 48;

  // type
  const nameSize = mobile ? 39 : 58;
  const nameY = mobile ? 86 : 108;
  const name = text('display', profile.name, padX - 2, nameY, nameSize, { fill: t.text, tracking: nameSize * -0.024 });
  let role = '';
  const seg = (s) => ({ text: s.text, fill: s.tone ? t.tones[s.tone] : t.text2 });
  if (mobile) {
    // one role per line
    const lines = [[0, 1], [2], [3, 4, 5]].map((idx) => idx.map((i) => seg(profile.roleLine[i])));
    lines[2][0].text = lines[2][0].text.trimStart();
    lines.forEach((line, i) => (role += textRun('body', line, padX, nameY + 40 + i * 25, 17.5).svg));
  } else {
    role = textRun('body', profile.roleLine.map(seg), padX, nameY + 42, 19.5).svg;
  }

  // signal graph: three lanes merge into one trunk that ends in production
  const x0 = padX + 4;
  const laneGap = mobile ? 34 : 36;
  const midY = mobile ? 288 : 244;
  const bend = mobile ? 214 : 420; // x where the outer lanes leave their track
  const merge = bend + laneGap; // x where they land on the middle track
  const endX = mobile ? 352 : 718;
  const k = 10, kd = 7.07; // corner rounding
  const lanes = disciplines.map((d, i) => {
    const y = midY + (i - 1) * laneGap;
    const dir = Math.sign(midY - y); // +1 runs down to the trunk, -1 up, 0 straight
    const path = dir === 0
      ? `M${x0} ${y}H${merge + k}`
      : `M${x0} ${y}H${bend - k}Q${bend} ${y} ${n(bend + kd)} ${n(y + dir * kd)}L${n(merge - kd)} ${n(midY - dir * kd)}Q${merge} ${midY} ${merge + k} ${midY}`;
    return { d, y, path, tone: t.tones[d.id] };
  });
  const trunk = `M${merge + k} ${midY}H${endX}`;
  const commits = mobile
    ? [[112, 168], [92, 150, 196], [126, 180]]
    : [[176, 262, 352], [148, 232, 318, 392], [204, 300, 376]];
  const trunkCommits = mobile ? [296] : [548, 634];

  let graph = '';
  for (const lane of lanes) graph += `<path d="${lane.path}" fill="none" stroke="${lane.tone}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  graph += `<path d="${trunk}" fill="none" stroke="${t.text}" stroke-width="2" stroke-linecap="round"/>`;
  // travelling light: a short bright dash runs down every lane, then down the trunk
  // (a wide faint stroke under a thin bright one reads as a glow without needing an SVG filter)
  const pulse = (cls, d, color) =>
    `<path class="pulse ${cls}" pathLength="1000" d="${d}" fill="none" stroke="${color}" stroke-opacity=".28" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path class="pulse ${cls}" pathLength="1000" d="${d}" fill="none" stroke="${themeName === 'dark' ? mix(color, '#FFFFFF', 0.55) : color}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  lanes.forEach((lane) => (graph += pulse('lane', lane.path, lane.tone)));
  graph += pulse('trunk', trunk, t.text);
  lanes.forEach((lane, i) => {
    graph += `<circle cx="${x0}" cy="${lane.y}" r="4.5" fill="${lane.tone}"/>`;
    graph += text('mono', lane.d.lane, x0 + 14, lane.y - 9, 11, { fill: lane.tone }).svg;
    for (const cx of commits[i]) graph += `<circle cx="${cx}" cy="${lane.y}" r="3.6" fill="${t.faceBottom}" stroke="${lane.tone}" stroke-width="1.8"/>`;
  });
  for (const cx of trunkCommits) graph += `<circle cx="${cx}" cy="${midY}" r="3.6" fill="${t.faceBottom}" stroke="${t.text}" stroke-width="1.8"/>`;
  const mergeX = merge + k + (mobile ? 16 : 22);
  graph += `<circle cx="${mergeX}" cy="${midY}" r="6.5" fill="${t.text}"/><circle class="flash f1" cx="${mergeX}" cy="${midY}" r="6.5" fill="none" stroke="${t.text}" stroke-width="1.5"/>`;
  graph += `<circle cx="${endX}" cy="${midY}" r="11" fill="${t.faceBottom}" stroke="${t.text}" stroke-width="1.8"/><circle cx="${endX}" cy="${midY}" r="4.8" fill="${t.text}"/><circle class="flash f2" cx="${endX}" cy="${midY}" r="11" fill="none" stroke="${t.text}" stroke-width="1.5"/>`;
  graph += text('mono', 'production', endX + 11, midY - 22, 11, { fill: t.text2, anchor: 'end' }).svg;

  const glows = lanes.map((lane, i) => {
    const cx = mobile ? [150, 230, 140][i] : [250, 470, 270][i];
    return `<ellipse cx="${cx}" cy="${lane.y}" rx="${mobile ? 170 : 260}" ry="${mobile ? 60 : 70}" fill="url(#glow-${lane.d.id})"/>`;
  }).join('');

  const style =
    // The dash pattern repeats every dash+gap units, so an offset of period+52 parks the dash just before
    // the start of the path and period-1010 just past its end. That keeps every offset positive (older
    // Safari mishandles negative ones) and overshoots both ends, because a dash that stops exactly on an
    // end point leaves its round cap behind as a stray dot.
    `.pulse{stroke-dasharray:46 1200;stroke-dashoffset:1298}.trunk{stroke-dasharray:84 1200;stroke-dashoffset:1374}` +
    `.lane{animation:lane 9s cubic-bezier(.5,0,.3,1) infinite}.trunk{animation:trunk 9s cubic-bezier(.4,0,.3,1) infinite}` +
    `.flash{opacity:0;transform-box:fill-box;transform-origin:center}.f1{animation:f1 9s ease-out infinite}.f2{animation:f2 9s ease-out infinite}` +
    `@keyframes lane{0%,8%{stroke-dashoffset:1298}38%,100%{stroke-dashoffset:236}}` +
    `@keyframes trunk{0%,37%{stroke-dashoffset:1374}58%,100%{stroke-dashoffset:274}}` +
    `@keyframes f1{0%,36%{opacity:0;transform:scale(1)}38%{opacity:.9}48%,100%{opacity:0;transform:scale(2.6)}}` +
    `@keyframes f2{0%,56%{opacity:0;transform:scale(1)}58%{opacity:.9}70%,100%{opacity:0;transform:scale(2.3)}}` +
    REDUCED;

  const defs =
    `<linearGradient id="face" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.faceTop}"/><stop offset="1" stop-color="${t.faceBottom}"/></linearGradient>` +
    `<clipPath id="panel"><rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" rx="20"/></clipPath>` +
    `<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1" fill="${t.dot}" fill-opacity="${t.dotOpacity}"/></pattern>` +
    `<radialGradient id="fade" cx="1" cy="0" r="1.05"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<mask id="dotmask"><rect width="${w}" height="${h}" fill="url(#fade)"/></mask>` +
    lanes.map((lane) => `<radialGradient id="glow-${lane.d.id}"><stop offset="0" stop-color="${lane.tone}" stop-opacity="${t.glow}"/><stop offset="1" stop-color="${lane.tone}" stop-opacity="0"/></radialGradient>`).join('');

  const body =
    `<rect x="${m + 0.5}" y="${m + 0.5}" width="${w - 2 * m - 1}" height="${h - 2 * m - 1}" rx="20" fill="url(#face)" stroke="${t.border}"/>` +
    `<g clip-path="url(#panel)">${glows}<rect width="${w}" height="${h}" fill="url(#dots)" mask="url(#dotmask)"/></g>` +
    name.svg + role + graph;

  return {
    w, h,
    label: `${profile.name}. ${profile.roleLine.map((s) => s.text).join('')} Three lines, full-stack, infrastructure and AI, merge into one and run to production.`,
    style, defs, body,
  };
}

const hero = (themeName, mobile = false) => doc(heroParts(themeName, mobile));

// ───────────────────────────── contact button + footer ─────────────────────────────

function emailButton(themeName) {
  const t = themes[themeName];
  const w = 340, h = 76, m = 6;
  const body =
    `<rect x="${m + 0.5}" y="${m + 0.5}" width="${w - 2 * m - 1}" height="${h - 2 * m - 1}" rx="14" fill="url(#face)" stroke="${t.border}"/>` +
    `<rect x="${m + 14}" y="${m + 14}" width="36" height="36" rx="10" fill="${t.text}" fill-opacity=".07"/>` +
    icon('mail', m + 23, m + 23, 18, t.text) +
    text('title', 'Get in touch', m + 62, m + 29, 15, { fill: t.text }).svg +
    text('mono', profile.email, m + 62, m + 47, 11.5, { fill: t.text2 }).svg +
    icon('arrow-up-right', w - m - 34, m + 24, 16, t.muted);
  return doc({
    w, h, label: `Get in touch: ${profile.email}`,
    defs: `<linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.faceTop}"/><stop offset="1" stop-color="${t.faceBottom}"/></linearGradient>`,
    body,
  });
}

function footer(themeName) {
  const t = themes[themeName];
  const w = 800, h = 56, y = 28;
  const tones = Object.values(t.tones);
  const layout = (line, size, r, step, gap) => {
    const label = text('regular', line, w / 2 + (3 * step) / 2, y + size * 0.34, size, { fill: t.muted, anchor: 'middle' });
    const dots = tones.map((tone, i) => `<circle cx="${n(label.x0 - gap - (2 - i) * step)}" cy="${y}" r="${r}" fill="${tone}"/>`).join('');
    const rules = `<path d="M6 ${y}H${n(label.x0 - gap - 2 * step - gap)}M${n(label.x0 + label.width + gap)} ${y}H${w - 6}" stroke="${t.rule}" stroke-opacity="${t.ruleOpacity}"/>`;
    return rules + dots + label.svg;
  };
  return doc({
    w, h, label: footerLine, style: RESPONSIVE,
    body: `<g class="wide">${layout(footerLine, 12.5, 3, 12, 16)}</g><g class="narrow">${layout(footerLineShort, 27, 6.5, 26, 30)}</g>`,
  });
}

// ───────────────────────────── write everything ─────────────────────────────

const svgoConfig = {
  multipass: true,
  floatPrecision: 2,
  plugins: [{
    name: 'preset-default',
    params: {
      overrides: {
        removeViewBox: false, cleanupIds: false, inlineStyles: false, minifyStyles: false, removeTitle: false,
        removeUnknownsAndDefaults: { keepRoleAttr: true, keepAriaAttrs: true },
        // svgo 3.3 crashes when it tries to turn glyph outlines into smooth-curve shorthands
        convertPathData: { curveSmoothShorthands: false },
      },
    },
  }],
};

let total = 0;
const count = { files: 0 };
function emit(themeName, file, svg) {
  const out = optimize(svg, svgoConfig).data;
  writeFileSync(join(root, 'assets', themeName, `${file}.svg`), out);
  total += out.length;
  count.files++;
}

if (existsSync(join(root, 'assets'))) rmSync(join(root, 'assets'), { recursive: true });
for (const themeName of Object.keys(themes)) {
  mkdirSync(join(root, 'assets', themeName), { recursive: true });
  emit(themeName, 'hero', hero(themeName));
  emit(themeName, 'hero-mobile', hero(themeName, true));
  emit(themeName, 'footer', footer(themeName));
  emit(themeName, 'contact-email', emailButton(themeName));
  for (const disc of disciplines) {
    emit(themeName, `heading-${disc.id}`, heading(themeName, disc));
    // cards sit two per row: both cards of a row get the height of the taller one
    for (let i = 0; i < disc.cards.length; i += 2) {
      const pair = disc.cards.slice(i, i + 2);
      const counts = pair.map((c) => chipRows(c.chips).length);
      const rowCount = Math.max(...counts);
      if (themeName === 'dark' && new Set(counts).size > 1) console.warn(`! uneven row: ${pair.map((c, k) => `${c.id}=${counts[k]}`).join(' vs ')} chip rows`);
      pair.forEach((c, j) => emit(themeName, `card-${c.id}`, card(themeName, disc, c, rowCount, i + j)));
    }
  }
}

// ───────────────────────────── README blocks ─────────────────────────────

// How GitHub treats <picture>: while the viewer's theme is "sync with system" the media queries run
// as written. If the viewer forces a theme, the themed-picture script replaces the WHOLE media
// attribute of every source that mentions prefers-color-scheme: "always match" for the forced theme,
// "not all" for the other one. Sources without a colour scheme are left alone. Hence:
//  - dark is the <img> fallback and light is the explicit source;
//  - a width may only be combined with the LIGHT scheme, and the desktop-light source comes first, so
//    that a forced light theme resolves to the desktop image rather than to the phone image.
// URLs are absolute because the GitHub mobile apps do not resolve relative paths inside <picture>.
const url = (theme, file) => `${assetBase}/${theme}/${file}.svg`;
const picture = (file, width, alt) =>
  `<picture>` +
  `<source media="(prefers-color-scheme: light)" srcset="${url('light', file)}">` +
  `<img src="${url('dark', file)}" width="${width}" alt="${esc(alt)}">` +
  `</picture>`;
const PHONE = 540; // viewport width in px below which the phone hero is used
const heroPicture = (alt) =>
  `<picture>` +
  `<source media="(min-width: ${PHONE + 1}px) and (prefers-color-scheme: light)" srcset="${url('light', 'hero')}">` +
  `<source media="(max-width: ${PHONE}px) and (prefers-color-scheme: light)" srcset="${url('light', 'hero-mobile')}">` +
  `<source media="(max-width: ${PHONE}px)" srcset="${url('dark', 'hero-mobile')}">` +
  `<img src="${url('dark', 'hero')}" width="800" alt="${esc(alt)}">` +
  `</picture>`;

const blocks = {
  hero: `<p align="center">\n${heroPicture(`${profile.name}. ${profile.roleLine.map((s) => s.text).join('')}`)}\n</p>`,
  stack: disciplines.map((disc) => {
    const rows = [];
    for (let i = 0; i < disc.cards.length; i += 2) {
      rows.push(disc.cards.slice(i, i + 2).map((c) => picture(`card-${c.id}`, 400, `${c.title}: ${c.chips.join(', ')}`)).join(''));
    }
    return `<p align="center">\n${picture(`heading-${disc.id}`, 800, disc.title)}\n</p>\n<p align="center">\n${rows.join('\n')}\n</p>`;
  }).join('\n\n'),
  plain: disciplines.map((disc) =>
    `**${disc.title}**\n\n| Area | What I use |\n| :-- | :-- |\n` + disc.cards.map((c) => `| ${c.title} | ${c.chips.join(', ')} |`).join('\n'),
  ).join('\n\n'),
  contact: `<p align="center">\n<a href="mailto:${profile.email}">${picture('contact-email', 340, `Get in touch: ${profile.email}`)}</a>\n</p>`,
  footer: `<p align="center">\n${picture('footer', 800, footerLine)}\n</p>`,
};

const readmePath = join(root, 'README.md');
if (existsSync(readmePath)) {
  let readme = readFileSync(readmePath, 'utf8');
  for (const [key, html] of Object.entries(blocks)) {
    const re = new RegExp(`(<!-- ${key}:start -->)[\\s\\S]*?(<!-- ${key}:end -->)`);
    if (re.test(readme)) readme = readme.replace(re, `$1\n${html}\n$2`);
  }
  writeFileSync(readmePath, readme);
}

console.log(`${count.files} SVGs, ${(total / 1024).toFixed(0)} KB in total`);
