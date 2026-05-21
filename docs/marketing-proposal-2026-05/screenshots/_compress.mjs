// One-shot compression pass on the audit screenshots.
// PNGs straight out of Playwright are very large; we re-encode them through
// sharp at quality 78 so they don't bloat the repo. The visual fidelity is
// fine for an audit document.
import sharp from 'sharp';
import { readdir, stat, rename, unlink } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const files = (await readdir(HERE)).filter(f => f.endsWith('.png'));

for (const f of files) {
  const inPath = join(HERE, f);
  const outPath = inPath + '.tmp';
  const before = (await stat(inPath)).size;
  // Re-encode at quality 78. PNGs become smaller PNGs via re-deflate +
  // optional resize cap: we cap the long edge at 1600px (the originals are
  // 2× DPI screenshots, so 1600 still reads sharp in a markdown viewer).
  await sharp(inPath)
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9, quality: 78, effort: 9 })
    .toFile(outPath);
  const after = (await stat(outPath)).size;
  if (after < before) {
    await unlink(inPath);
    await rename(outPath, inPath);
    console.log(`${f}: ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB`);
  } else {
    await unlink(outPath);
    console.log(`${f}: already small (${(before / 1024).toFixed(0)}KB)`);
  }
}
