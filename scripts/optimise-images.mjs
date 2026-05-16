// One-shot image optimiser for ATEMA Studio.
// Reads /public/photos/*.{jpeg,jpg,png}, emits compressed JPEG + WebP variants
// next to the originals. WebP is the primary delivery format; JPEG stays as
// fallback for older browsers via <picture><source type="image/webp">.
//
// Usage:  node scripts/optimise-images.mjs
//
// Targets:
//   - Package photos (engagement, classic, royal, …): max-width 1200px,
//     JPEG q82, WebP q78  → typically 80-90% size reduction.
//   - Promotion landscape: max-width 1600px (modal caps at ~960 + retina).
//   - Promotion mobile portrait: max-width 1080px (mobile retina).

import sharp from 'sharp';
import { readdir, stat, writeFile } from 'node:fs/promises';
import { join, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Decode URL pathname (handles spaces / unicode in the project path) and
// produce an OS-native path that fs APIs accept on Windows + POSIX.
const ROOT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'photos');

// Per-asset overrides; default is package-photo profile.
const PROFILES = {
  'Promotion.PNG':         { maxW: 1600, jpegQ: 82, webpQ: 80 },
  'Promotion_Mobile.PNG':  { maxW: 1080, jpegQ: 82, webpQ: 80 },
};
const DEFAULT_PROFILE   = { maxW: 1200, jpegQ: 82, webpQ: 78 };

const SOURCE_EXTS = new Set(['.jpeg', '.jpg', '.png']);
const OPTIMISED_SUFFIX = '.optimised';   // we write *.optimised.jpg + *.webp

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function processOne(file) {
  const ext  = extname(file);
  const base = basename(file, ext);
  // Skip already-optimised outputs to keep the script idempotent.
  if (base.endsWith(OPTIMISED_SUFFIX) || ext === '.webp') return null;
  if (!SOURCE_EXTS.has(ext.toLowerCase())) return null;

  const profile = PROFILES[file] ?? DEFAULT_PROFILE;
  const inPath  = join(ROOT_PATH, file);
  const origSize = (await stat(inPath)).size;

  const src = sharp(inPath).rotate(); // honor EXIF orientation
  const { width: w0 } = await src.metadata();
  const pipeline = (w0 && w0 > profile.maxW)
    ? src.resize({ width: profile.maxW, withoutEnlargement: true })
    : src;

  // JPEG (fallback)
  const jpegOut  = join(ROOT_PATH, `${base}${OPTIMISED_SUFFIX}.jpg`);
  const jpegBuf  = await pipeline.clone()
    .jpeg({ quality: profile.jpegQ, progressive: true, mozjpeg: true })
    .toBuffer();
  await writeFile(jpegOut, jpegBuf);

  // WebP (primary)
  const webpOut = join(ROOT_PATH, `${base}.webp`);
  const webpBuf = await pipeline.clone()
    .webp({ quality: profile.webpQ, effort: 5 })
    .toBuffer();
  await writeFile(webpOut, webpBuf);

  return {
    file,
    orig: origSize,
    jpeg: jpegBuf.length,
    webp: webpBuf.length,
  };
}

async function main() {
  const entries = await readdir(ROOT_PATH);
  console.log('ATEMA — image optimisation');
  console.log('========================================================');
  const rows = [];
  for (const f of entries) {
    try {
      const r = await processOne(f);
      if (r) rows.push(r);
    } catch (err) {
      console.error(`!  ${f}:`, err.message);
    }
  }

  let totalOrig = 0, totalWebp = 0, totalJpeg = 0;
  for (const r of rows) {
    totalOrig += r.orig; totalWebp += r.webp; totalJpeg += r.jpeg;
    const pctW = ((1 - r.webp / r.orig) * 100).toFixed(1);
    const pctJ = ((1 - r.jpeg / r.orig) * 100).toFixed(1);
    console.log(
      `${r.file.padEnd(26)}  ` +
      `orig ${fmtSize(r.orig).padStart(8)}  ` +
      `→ jpeg ${fmtSize(r.jpeg).padStart(7)} (-${pctJ}%)  ` +
      `webp ${fmtSize(r.webp).padStart(7)} (-${pctW}%)`
    );
  }
  console.log('--------------------------------------------------------');
  console.log(`TOTAL                       orig ${fmtSize(totalOrig)}  ` +
              `jpeg ${fmtSize(totalJpeg)}  webp ${fmtSize(totalWebp)}`);
  console.log(`Combined savings vs orig:   ${(((totalOrig - totalWebp) / totalOrig) * 100).toFixed(1)}% (WebP)`);
}

main().catch(err => { console.error(err); process.exit(1); });
