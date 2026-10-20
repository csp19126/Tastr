// Draws the Tastr logo (a steaming bowl with chopsticks) and writes every app image from it:
// icon, Android icon layers, splash, favicon and the in-app logo. Run: node art/build.mjs
// (uses sharp from api/node_modules, so run `npm ci` in api/ first).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(path.join(here, '../api/package.json'))('sharp');
const out = (p) => path.join(here, '../mobile/assets', p);

const C = { chilli: '#E2552B', cream: '#FFF4E6', bowl: '#FFFFFF', rim: '#2B1D14', broth: '#F2B653', stick: '#FFD9AE' };

/** The bowl, centred in a 512 box. mono = single-colour silhouette for Android themed icons. */
function bowl(mono = false) {
  const f = (c) => (mono ? '#FFFFFF' : c);
  return `
    <g stroke="${f(C.cream)}" stroke-width="18" fill="none" stroke-linecap="round" opacity="${mono ? 1 : 0.9}">
      <path d="M196 132 q-22 -34 0 -66"/><path d="M256 120 q-22 -34 0 -66"/><path d="M316 132 q-22 -34 0 -66"/>
    </g>
    <g stroke="${f(C.stick)}" stroke-width="16" stroke-linecap="round">
      <path d="M300 250 L 420 120"/><path d="M330 258 L 450 140"/>
    </g>
    <path d="M86 236 H 426 C 426 336, 352 410, 256 410 C 160 410, 86 336, 86 236 Z" fill="${f(C.bowl)}"/>
    ${mono ? '' : `<ellipse cx="256" cy="236" rx="170" ry="26" fill="${C.broth}"/>
    <path d="M86 236 H 426" stroke="${C.rim}" stroke-width="10" stroke-linecap="round"/>
    <path d="M150 300 H 362" stroke="${C.chilli}" stroke-width="12" stroke-linecap="round" opacity="0.85"/>`}
    <rect x="196" y="404" width="120" height="26" rx="10" fill="${f(mono ? '#FFFFFF' : C.rim)}"/>`;
}

const svg = (inner, size, bg) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    ${bg ? `<rect width="512" height="512" fill="${bg}"/>` : ''}${inner}</svg>`);
const inset = (inner, scale) => `<g transform="translate(${256 - 256 * scale} ${256 - 256 * scale}) scale(${scale})">${inner}</g>`;

const jobs = [
  ['images/icon.png', svg(inset(bowl(), 0.78), 1024, C.chilli), 1024],
  ['images/android-icon-foreground.png', svg(inset(bowl(), 0.56), 1024), 1024],
  ['images/android-icon-monochrome.png', svg(inset(bowl(true), 0.56), 1024), 1024],
  ['images/android-icon-background.png', svg('', 1024, C.chilli), 1024],
  ['images/splash-icon.png', svg(inset(bowl(), 0.9), 512, C.chilli), 512],
  ['images/favicon.png', svg(inset(bowl(), 0.86), 96, C.chilli), 96],
  ['images/logo.png', svg(`<rect x="16" y="16" width="480" height="480" rx="112" fill="${C.chilli}"/>${inset(bowl(), 0.74)}`, 360), 360],
];

for (const [file, buf, size] of jobs) {
  fs.mkdirSync(path.dirname(out(file)), { recursive: true });
  await sharp(buf, { density: 72 * (size / 512) * 2 }).resize(size, size).png().toFile(out(file));
  console.log('wrote', file);
}
