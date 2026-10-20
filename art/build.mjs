// Draws the Tastr dog and writes every app image from it: icon, Android icon layers,
// splash, favicon and the mascot moods used in the app. Run: node art/build.mjs
// (uses sharp from api/node_modules, so run `npm ci` in api/ first).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(path.join(here, '../api/package.json'))('sharp');
const out = (p) => path.join(here, '../mobile/assets', p);

const C = { fur: '#E9A55B', ear: '#8A5232', patch: '#C9803F', muzzle: '#FCE9D2', ink: '#2B1D14', tongue: '#F06A73', cream: '#FFF4E6', chilli: '#E2552B' };

/** The dog's head, centred in a 512 box. mood: happy | sniff | sleep */
function dog(mood = 'happy', mono = false) {
  const f = (c) => (mono ? '#FFFFFF' : c);
  const eyes =
    mood === 'sleep'
      ? `<path d="M182 238 q18 14 36 0" stroke="${f(C.ink)}" stroke-width="9" fill="none" stroke-linecap="round"/>
         <path d="M294 238 q18 14 36 0" stroke="${f(C.ink)}" stroke-width="9" fill="none" stroke-linecap="round"/>`
      : mood === 'sniff'
        ? `<path d="M182 240 q18 -10 36 0" stroke="${f(C.ink)}" stroke-width="9" fill="none" stroke-linecap="round"/>
           <path d="M294 240 q18 -10 36 0" stroke="${f(C.ink)}" stroke-width="9" fill="none" stroke-linecap="round"/>`
        : `<circle cx="200" cy="238" r="17" fill="${f(C.ink)}"/><circle cx="312" cy="238" r="17" fill="${f(C.ink)}"/>
           ${mono ? '' : `<circle cx="206" cy="232" r="5.5" fill="#fff"/><circle cx="318" cy="232" r="5.5" fill="#fff"/>`}`;
  const tongue =
    mood === 'happy' && !mono
      ? `<path d="M240 352 q16 34 32 0 z" fill="${C.tongue}"/><path d="M256 354 v14" stroke="#C94A55" stroke-width="3" stroke-linecap="round"/>`
      : '';
  const extras =
    mood === 'sniff'
      ? `<g stroke="${f(C.chilli)}" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.9">
           <path d="M440 300 q16 -12 0 -26"/><path d="M466 316 q24 -20 0 -46"/><path d="M72 300 q-16 -12 0 -26"/></g>`
      : mood === 'sleep'
        ? `<g fill="${f(C.ear)}" font-family="Arial, sans-serif" font-weight="700">
             <text x="372" y="150" font-size="44">z</text><text x="404" y="112" font-size="32">z</text></g>`
        : '';
  const tilt = mood === 'sniff' ? 'rotate(-8 256 280)' : '';
  return `<g transform="${tilt}">
    <path d="M150 168 C 96 150, 58 220, 74 300 C 84 352, 128 360, 150 318 C 160 280, 166 220, 186 186 Z" fill="${f(C.ear)}"/>
    <path d="M362 168 C 416 150, 454 220, 438 300 C 428 352, 384 360, 362 318 C 352 280, 346 220, 326 186 Z" fill="${f(C.ear)}"/>
    <ellipse cx="256" cy="268" rx="148" ry="138" fill="${f(C.fur)}"/>
    ${mono ? '' : `<ellipse cx="316" cy="232" rx="44" ry="38" fill="${C.patch}"/>`}
    <ellipse cx="256" cy="328" rx="86" ry="64" fill="${mono ? '#000' : C.muzzle}" ${mono ? 'opacity="0"' : ''}/>
    ${mono ? '' : eyes}
    <ellipse cx="256" cy="300" rx="30" ry="21" fill="${mono ? '#000' : C.ink}" ${mono ? 'opacity="0"' : ''}/>
    ${mono ? '' : `<ellipse cx="247" cy="293" rx="9" ry="5" fill="#fff" opacity="0.55"/>`}
    ${mono ? '' : `<path d="M256 321 v18 M256 339 q-22 18 -40 2 M256 339 q22 18 40 2" stroke="${C.ink}" stroke-width="7" fill="none" stroke-linecap="round"/>`}
    ${tongue}
  </g>${extras}`;
}

const svg = (inner, size = 512, bg) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    ${bg ? `<rect width="512" height="512" fill="${bg}"/>` : ''}${inner}</svg>`);

/** Shrinks the dog into the middle of the canvas (Android icons must fit a safe zone). */
const inset = (inner, scale) => `<g transform="translate(${256 - 256 * scale} ${256 - 256 * scale}) scale(${scale})">${inner}</g>`;

const jobs = [
  ['images/icon.png', svg(inset(dog('happy'), 0.86), 1024, C.cream), 1024],
  ['images/android-icon-foreground.png', svg(inset(dog('happy'), 0.6), 1024), 1024],
  ['images/android-icon-monochrome.png', svg(inset(dog('happy', true), 0.6), 1024), 1024],
  ['images/android-icon-background.png', svg('', 1024, C.cream), 1024],
  ['images/splash-icon.png', svg(dog('sniff'), 512), 512],
  ['images/favicon.png', svg(dog('happy'), 96), 96],
  ['mascot/happy.png', svg(dog('happy'), 360), 360],
  ['mascot/sniff.png', svg(dog('sniff'), 360), 360],
  ['mascot/sleep.png', svg(dog('sleep'), 360), 360],
];

for (const [file, buf, size] of jobs) {
  fs.mkdirSync(path.dirname(out(file)), { recursive: true });
  await sharp(buf, { density: 72 * (size / 512) * 2 }).resize(size, size).png().toFile(out(file));
  console.log('wrote', file);
}
