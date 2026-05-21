// Photo-adequacy audit for the marketing proposal.
// For every JPEG in public/photos/, we measure: resolution, aspect ratio,
// orientation (portrait vs landscape vs square), file size (JPEG + WebP pair),
// and mean luminance + contrast (proxy for "is this photo too dark/flat to
// thumbnail on a white IG grid or a dark editorial wall?").
//
// Output: docs/marketing-proposal-2026-05/screenshots/_photo-audit.json plus
// a markdown summary.
import sharp from 'sharp';
import { readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const PHOTOS = join(REPO, 'public', 'photos');

const files = (await readdir(PHOTOS)).filter(f => /\.jpe?g$/i.test(f));
const rows = [];

for (const f of files) {
  const jpegPath = join(PHOTOS, f);
  const webpPath = jpegPath.replace(/\.[^.]+$/, '.webp');
  const meta = await sharp(jpegPath).metadata();
  const stats = await sharp(jpegPath).stats();
  const luminance = stats.channels
    .slice(0, 3)
    .reduce((s, c) => s + c.mean, 0) / 3;
  const stdev = stats.channels
    .slice(0, 3)
    .reduce((s, c) => s + c.stdev, 0) / 3;
  const jpegBytes = (await stat(jpegPath)).size;
  let webpBytes = null;
  try { webpBytes = (await stat(webpPath)).size; } catch {}
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const ratio = w && h ? w / h : 0;
  const orientation = ratio > 1.2 ? 'landscape' : ratio < 0.85 ? 'portrait' : 'square';
  rows.push({
    file: f,
    width: w,
    height: h,
    megapixels: +(w * h / 1e6).toFixed(2),
    ratio: +ratio.toFixed(3),
    orientation,
    luminance: +luminance.toFixed(1),
    contrast: +stdev.toFixed(1),
    jpegKB: +(jpegBytes / 1024).toFixed(1),
    webpKB: webpBytes ? +(webpBytes / 1024).toFixed(1) : null,
    hasWebp: webpBytes !== null,
  });
}

rows.sort((a, b) => a.luminance - b.luminance);

await writeFile(
  join(HERE, '_photo-audit.json'),
  JSON.stringify(rows, null, 2),
);

// Summary stats.
const total = rows.length;
const byOrientation = rows.reduce((acc, r) => {
  acc[r.orientation] = (acc[r.orientation] || 0) + 1;
  return acc;
}, {});
const tooDark = rows.filter(r => r.luminance < 60).length;
const tooBright = rows.filter(r => r.luminance > 200).length;
const lowContrast = rows.filter(r => r.contrast < 35).length;
const underHd = rows.filter(r => r.width < 1080 || r.height < 1080).length;
const missingWebp = rows.filter(r => !r.hasWebp).length;
const avgJpegKB = +(rows.reduce((s, r) => s + r.jpegKB, 0) / total).toFixed(1);
const avgWebpKB = +(rows.filter(r => r.webpKB).reduce((s, r) => s + r.webpKB, 0) / rows.filter(r => r.webpKB).length).toFixed(1);

const summary = {
  total,
  byOrientation,
  tooDark,
  tooBright,
  lowContrast,
  underHd,
  missingWebp,
  avgJpegKB,
  avgWebpKB,
  webpSavingsPct: +((1 - avgWebpKB / avgJpegKB) * 100).toFixed(1),
};

await writeFile(
  join(HERE, '_photo-audit-summary.json'),
  JSON.stringify(summary, null, 2),
);

console.log('Summary:', summary);
console.log('\nDarkest 5:');
rows.slice(0, 5).forEach(r => console.log(`  ${r.file}  lum=${r.luminance}  contrast=${r.contrast}  ${r.width}x${r.height}`));
console.log('\nBrightest 5:');
rows.slice(-5).forEach(r => console.log(`  ${r.file}  lum=${r.luminance}  contrast=${r.contrast}  ${r.width}x${r.height}`));
