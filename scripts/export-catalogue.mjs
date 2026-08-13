#!/usr/bin/env node
// Preserves the live `packages` + `addons` tables against repo drift.
//
// The owner edits prices/toggles in the admin panel, which writes to
// Supabase only (see CLAUDE.md §6 "Catalogue prices live in Supabase, NOT
// in the repo"). Two repo files stand in for that table during an outage —
// database/seed-packages-2026-05.sql and the DEMO array in
// src/hooks/usePackagesData.ts — and both go stale the moment a price
// changes. Historically a human re-synced them by hand after every
// repricing round (see commit 6b6ed8d). This script automates that:
//
//   1. Writes a full, timestamped, mechanically-generated snapshot to
//      database/backups/catalogue-<date>.sql — the actual "preserve the
//      database" artifact. Deliberately NOT wired into
//      .github/workflows/supabase-migrations.yml's manifest, so it can
//      never be silently applied and clobber the owner's live edits.
//   2. Patches ONLY the scalar fields (price, duration_hours,
//      edited_photos, editorial_photos, video, is_popular, active,
//      sort_order for packages; price, active, sort_order for addons)
//      in-place inside seed-packages-2026-05.sql and the DEMO array,
//      preserving every surrounding character (comments, alignment,
//      hand-written prose) when a value is unchanged.
//   3. Leaves text/array fields (names, description, features, album,
//      badge, included_addon_ids) untouched. Those carry bilingual copy
//      judgement a mechanical patch would risk mangling — instead the
//      script prints a warning with old -> new so a human folds it in.
//
// Usage:
//   node scripts/export-catalogue.mjs              live run — needs
//                                                   SUPABASE_URL (or
//                                                   VITE_SUPABASE_URL) +
//                                                   SUPABASE_ANON_KEY (or
//                                                   VITE_SUPABASE_ANON_KEY)
//   node scripts/export-catalogue.mjs --self-test   no network — round-trips
//                                                   the current repo files
//                                                   against themselves and
//                                                   asserts a byte-identical
//                                                   rewrite (regression guard
//                                                   for the patch logic).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SEED_PATH = path.join(ROOT, 'database/seed-packages-2026-05.sql');
const DEMO_PATH = path.join(ROOT, 'src/hooks/usePackagesData.ts');
const BACKUPS_DIR = path.join(ROOT, 'database/backups');

const warnings = [];
const changes = [];

function escSql(str) {
  return String(str).replace(/'/g, "''");
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return `array[${value.map((v) => `'${escSql(v)}'`).join(',')}]::text[]`;
  }
  return `'${escSql(value)}'`;
}

// ─── 1. Fetch live tables ────────────────────────────────────────────────

async function fetchTable(url, anonKey, table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&order=id.asc`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) {
    throw new Error(`Fetching ${table} failed: HTTP ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// ─── 2. Mechanical backup snapshot ───────────────────────────────────────

function buildBackupSql(packages, addons, timestamp) {
  const SKIP_COLS = new Set(['created_at', 'updated_at']);

  const rowTuple = (row) => {
    const cols = Object.keys(row).filter((c) => !SKIP_COLS.has(c));
    return `(${cols.map((c) => sqlLiteral(row[c])).join(', ')})`;
  };

  const packageCols = packages.length
    ? Object.keys(packages[0]).filter((c) => !SKIP_COLS.has(c))
    : [];
  const addonCols = addons.length
    ? Object.keys(addons[0]).filter((c) => !SKIP_COLS.has(c))
    : [];

  const updateSet = (cols) =>
    cols
      .filter((c) => c !== 'id')
      .map((c) => `  ${c} = excluded.${c}`)
      .join(',\n');

  return `-- ATEMA STUDIO — machine-generated catalogue backup
-- Snapshot of the live \`packages\` + \`addons\` tables, taken ${timestamp}.
--
-- This is a POINT-IN-TIME BACKUP, not an active seed. It is deliberately
-- NOT referenced by .github/workflows/supabase-migrations.yml, so running
-- migrations never applies it. To restore from this snapshot, run it by
-- hand via the Supabase SQL editor or a manual \`only-file\` workflow
-- dispatch — it is a safe idempotent UPSERT either way.
--
-- Generated by scripts/export-catalogue.mjs — do not hand-edit; re-run the
-- script to refresh instead.

${
  addonCols.length
    ? `insert into public.addons (${addonCols.join(', ')})
values
${addons.map((a) => '  ' + rowTuple(a)).join(',\n')}
on conflict (id) do update set
${updateSet(addonCols)};
`
    : '-- (addons table empty at export time)'
}

${
  packageCols.length
    ? `insert into public.packages (${packageCols.join(', ')})
values
${packages.map((p) => '  ' + rowTuple(p)).join(',\n')}
on conflict (id) do update set
${updateSet(packageCols)};
`
    : '-- (packages table empty at export time)'
}
`;
}

// ─── 3. Targeted patch: database/seed-packages-2026-05.sql ──────────────

function patchSeedFile(text, packages, addons) {
  const pkgById = new Map(packages.map((p) => [p.id, p]));
  const addonById = new Map(addons.map((a) => [a.id, a]));

  const lines = text.split('\n');
  const out = [];

  const ADDON_RE =
    /^(\s*\(')([\w-]+)(',)(\s*)'((?:[^'\\]|\\.)*)'(,)(\s*)'((?:[^'\\]|\\.)*)'(,)(\s*)(\d+)(,)(\s*)(true|false)(,)(\s*)(\d+)(\),?)$/;

  const PKG_HEAD_RE =
    /^\((\d+), '((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)', (\d+), (\d+), (\d+),$/;

  const PKG_ALBUM_VIDEO_RE = /^ (NULL|'(?:[^'\\]|\\.)*'), (true|false),$/;

  const PKG_TAIL_RE =
    /^ ('(?:[^'\\]|\\.)*'|NULL), (true|false), (true|false), (\d+), (array\[[^\]]*\]::text\[\]\),?)$/;

  let currentPkgId = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Addon line
    const addonMatch = line.match(ADDON_RE);
    if (addonMatch) {
      const [, p1, id, p3, ws1, nameAr, p6, ws2, nameEn, p9, ws3, price, p12, ws4, active, p15, ws5, sortOrder, tail] =
        addonMatch;
      const live = addonById.get(id);
      if (live) {
        if (live.name_ar !== nameAr || live.name_en !== nameEn) {
          warnings.push(
            `addons.${id}: name changed live (ar: "${nameAr}" -> "${live.name_ar}", en: "${nameEn}" -> "${live.name_en}") — not auto-patched, review by hand.`,
          );
        }
        const newPrice = String(live.price);
        const newActive = live.active ? 'true' : 'false';
        const newSort = String(live.sort_order ?? sortOrder);
        if (newPrice !== price) changes.push(`addons.${id}.price: ${price} -> ${newPrice}`);
        if (newActive !== active) changes.push(`addons.${id}.active: ${active} -> ${newActive}`);
        if (newSort !== sortOrder) changes.push(`addons.${id}.sort_order: ${sortOrder} -> ${newSort}`);
        line =
          p1 + id + p3 + ws1 + `'${nameAr}'` + p6 + ws2 + `'${nameEn}'` + p9 + ws3 + newPrice + p12 + ws4 + newActive + p15 + ws5 + newSort + tail;
      } else {
        warnings.push(`addons.${id}: present in repo seed but not found in live table.`);
      }
      out.push(line);
      continue;
    }

    // Package tuple head
    const headMatch = line.match(PKG_HEAD_RE);
    if (headMatch) {
      const [, id, nameAr, nameEn, price, hours, photos] = headMatch;
      currentPkgId = Number(id);
      const live = pkgById.get(currentPkgId);
      if (live) {
        if (live.name_ar !== nameAr || live.name_en !== nameEn) {
          warnings.push(
            `packages.${id}: name changed live (ar: "${nameAr}" -> "${live.name_ar}", en: "${nameEn}" -> "${live.name_en}") — not auto-patched, review by hand.`,
          );
        }
        const newPrice = String(live.price);
        const newHours = String(live.duration_hours);
        const newPhotos = String(live.edited_photos);
        if (newPrice !== price) changes.push(`packages.${id}.price: ${price} -> ${newPrice}`);
        if (newHours !== hours) changes.push(`packages.${id}.duration_hours: ${hours} -> ${newHours}`);
        if (newPhotos !== photos) changes.push(`packages.${id}.edited_photos: ${photos} -> ${newPhotos}`);
        line = `(${id}, '${nameAr}', '${nameEn}', ${newPrice}, ${newHours}, ${newPhotos},`;
      } else {
        warnings.push(`packages.${id}: present in repo seed but not found in live table.`);
      }
      out.push(line);
      continue;
    }

    // Package album/video line (immediately follows a head line)
    const avMatch = line.match(PKG_ALBUM_VIDEO_RE);
    if (avMatch && currentPkgId !== null) {
      const [, album, video] = avMatch;
      const live = pkgById.get(currentPkgId);
      if (live) {
        const liveAlbum = live.album === null ? 'NULL' : `'${live.album}'`;
        if (liveAlbum !== album) {
          warnings.push(`packages.${currentPkgId}.album changed live (${album} -> ${liveAlbum}) — not auto-patched, review by hand.`);
        }
        const newVideo = live.video ? 'true' : 'false';
        if (newVideo !== video) changes.push(`packages.${currentPkgId}.video: ${video} -> ${newVideo}`);
        line = ` ${album}, ${newVideo},`;
      }
      out.push(line);
      continue;
    }

    // Package tail line (badge, is_popular, active, sort_order, included_addon_ids)
    const tailMatch = line.match(PKG_TAIL_RE);
    if (tailMatch && currentPkgId !== null) {
      const [, badge, isPopular, active, sortOrder, addonArrayTail] = tailMatch;
      const live = pkgById.get(currentPkgId);
      if (live) {
        const liveBadge = live.badge === null ? 'NULL' : `'${live.badge}'`;
        if (liveBadge !== badge) {
          warnings.push(`packages.${currentPkgId}.badge changed live (${badge} -> ${liveBadge}) — not auto-patched, review by hand.`);
        }
        const liveIncluded = JSON.stringify([...(live.included_addon_ids ?? [])].sort());
        const currentIncludedMatch = addonArrayTail.match(/array\[([^\]]*)\]/);
        const currentIncluded = JSON.stringify(
          (currentIncludedMatch[1] || '')
            .split(',')
            .map((s) => s.trim().replace(/^'|'$/g, ''))
            .filter(Boolean)
            .sort(),
        );
        if (liveIncluded !== currentIncluded) {
          warnings.push(
            `packages.${currentPkgId}.included_addon_ids changed live (${currentIncluded} -> ${liveIncluded}) — not auto-patched, review by hand.`,
          );
        }
        const newPopular = live.is_popular ? 'true' : 'false';
        const newActive = live.active ? 'true' : 'false';
        const newSort = String(live.sort_order ?? sortOrder);
        if (newPopular !== isPopular) changes.push(`packages.${currentPkgId}.is_popular: ${isPopular} -> ${newPopular}`);
        if (newActive !== active) changes.push(`packages.${currentPkgId}.active: ${active} -> ${newActive}`);
        if (newSort !== sortOrder) changes.push(`packages.${currentPkgId}.sort_order: ${sortOrder} -> ${newSort}`);
        line = ` ${badge}, ${newPopular}, ${newActive}, ${newSort}, ${addonArrayTail}`;
      }
      currentPkgId = null;
      out.push(line);
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

// ─── 4. Targeted patch: src/hooks/usePackagesData.ts DEMO array ─────────

function patchDemoFile(text, packages) {
  const pkgById = new Map(packages.map((p) => [p.id, p]));

  const HEAD_RE =
    /^(\s*\{ id: )(\d+)(, name_ar: ')((?:[^'\\]|\\.)*)((?:',)\s*name_en: ')((?:[^'\\]|\\.)*)((?:',)\s*price: )(\d+)((?:,\s*)duration_hours: )(\d+)((?:,\s*)edited_photos: )(\d+)((?:,\s*)editorial_photos: )(\d+)((?:,\s*)album: )(null|'[^']*')(,)$/;

  const TAIL_RE =
    /^(\s*badge: )(null|'[^']*')((?:,\s*)is_popular: )(true|false)((?:,\s*)active: )(true|false)((?:,\s*)included_addon_ids: )(\[[^\]]*\])((?:,\s*)is_custom_base: )(true|false)( \},)$/;

  let currentId = null;
  const lines = text.split('\n');
  const out = [];

  for (const rawLine of lines) {
    let line = rawLine;

    const head = line.match(HEAD_RE);
    if (head) {
      const [
        , p1, id, p3, nameAr, p5, nameEn, p7, price, p9, hours, p11, photos, p13, editorial, p15, album, p17,
      ] = head;
      currentId = Number(id);
      const live = pkgById.get(currentId);
      if (live) {
        if (live.name_ar !== nameAr || live.name_en !== nameEn) {
          warnings.push(
            `DEMO[${id}]: name changed live (ar: "${nameAr}" -> "${live.name_ar}", en: "${nameEn}" -> "${live.name_en}") — not auto-patched, review by hand.`,
          );
        }
        const liveAlbum = live.album === null ? 'null' : `'${live.album}'`;
        if (liveAlbum !== album) {
          warnings.push(`DEMO[${id}].album changed live (${album} -> ${liveAlbum}) — not auto-patched, review by hand.`);
        }
        const newPrice = String(live.price);
        const newHours = String(live.duration_hours);
        const newPhotos = String(live.edited_photos);
        const newEditorial = String(live.editorial_photos ?? editorial);
        if (newPrice !== price) changes.push(`DEMO[${id}].price: ${price} -> ${newPrice}`);
        if (newHours !== hours) changes.push(`DEMO[${id}].duration_hours: ${hours} -> ${newHours}`);
        if (newPhotos !== photos) changes.push(`DEMO[${id}].edited_photos: ${photos} -> ${newPhotos}`);
        if (newEditorial !== editorial) changes.push(`DEMO[${id}].editorial_photos: ${editorial} -> ${newEditorial}`);
        line =
          p1 + id + p3 + nameAr + p5 + nameEn + p7 + newPrice + p9 + newHours + p11 + newPhotos + p13 + newEditorial + p15 + album + p17;
      }
      out.push(line);
      continue;
    }

    const tail = line.match(TAIL_RE);
    if (tail && currentId !== null) {
      const [, p1, badge, p3, isPopular, p5, active, p7, includedIds, p9, isCustomBase, p11] = tail;
      const live = pkgById.get(currentId);
      if (live) {
        const liveBadge = live.badge === null ? 'null' : `'${live.badge}'`;
        if (liveBadge !== badge) {
          warnings.push(`DEMO[${currentId}].badge changed live (${badge} -> ${liveBadge}) — not auto-patched, review by hand.`);
        }
        const liveIncluded = JSON.stringify([...(live.included_addon_ids ?? [])].sort());
        const currentIncluded = JSON.stringify(
          [...includedIds.matchAll(/'([^']*)'/g)].map((m) => m[1]).sort(),
        );
        if (liveIncluded !== currentIncluded) {
          warnings.push(
            `DEMO[${currentId}].included_addon_ids changed live (${currentIncluded} -> ${liveIncluded}) — not auto-patched, review by hand.`,
          );
        }
        const newPopular = live.is_popular ? 'true' : 'false';
        const newActive = live.active ? 'true' : 'false';
        if (newPopular !== isPopular) changes.push(`DEMO[${currentId}].is_popular: ${isPopular} -> ${newPopular}`);
        if (newActive !== active) changes.push(`DEMO[${currentId}].active: ${active} -> ${newActive}`);
        line = p1 + badge + p3 + newPopular + p5 + newActive + p7 + includedIds + p9 + isCustomBase + p11;
      }
      currentId = null;
      out.push(line);
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

// ─── 5. Self-test: round-trip current repo files against themselves ─────

function extractPackagesFromSeed(text) {
  const pkgs = [];
  const HEAD_RE = /^\((\d+), '((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)', (\d+), (\d+), (\d+),$/;
  const AV_RE = /^ (NULL|'(?:[^'\\]|\\.)*'), (true|false),$/;
  const TAIL_RE = /^ ('(?:[^'\\]|\\.)*'|NULL), (true|false), (true|false), (\d+), array\[([^\]]*)\]::text\[\]\),?$/;
  const lines = text.split('\n');
  let cur = null;
  for (const line of lines) {
    const h = line.match(HEAD_RE);
    if (h) {
      cur = {
        id: Number(h[1]),
        name_ar: h[2],
        name_en: h[3],
        price: Number(h[4]),
        duration_hours: Number(h[5]),
        edited_photos: Number(h[6]),
      };
      continue;
    }
    const av = line.match(AV_RE);
    if (av && cur) {
      cur.album = av[1] === 'NULL' ? null : av[1].slice(1, -1);
      cur.video = av[2] === 'true';
      continue;
    }
    const t = line.match(TAIL_RE);
    if (t && cur) {
      cur.badge = t[1] === 'NULL' ? null : t[1].slice(1, -1);
      cur.is_popular = t[2] === 'true';
      cur.active = t[3] === 'true';
      cur.sort_order = Number(t[4]);
      cur.included_addon_ids = t[5]
        .split(',')
        .map((s) => s.trim().replace(/^'|'$/g, ''))
        .filter(Boolean);
      pkgs.push(cur);
      cur = null;
    }
  }
  return pkgs;
}

function extractAddonsFromSeed(text) {
  const addons = [];
  const RE = /^\s*\('([\w-]+)',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*(\d+),\s*(true|false),\s*(\d+)\),?$/;
  for (const line of text.split('\n')) {
    const m = line.match(RE);
    if (m) {
      addons.push({
        id: m[1],
        name_ar: m[2],
        name_en: m[3],
        price: Number(m[4]),
        active: m[5] === 'true',
        sort_order: Number(m[6]),
      });
    }
  }
  return addons;
}

function selfTest() {
  const seedText = readFileSync(SEED_PATH, 'utf8');
  const demoText = readFileSync(DEMO_PATH, 'utf8');

  const packages = extractPackagesFromSeed(seedText);
  const addons = extractAddonsFromSeed(seedText);

  if (packages.length === 0 || addons.length === 0) {
    console.error(`self-test FAILED: parser extracted ${packages.length} packages / ${addons.length} addons (expected > 0). Regex drift?`);
    process.exit(1);
  }

  const patchedSeed = patchSeedFile(seedText, packages, addons);
  const patchedDemo = patchDemoFile(demoText, packages);

  let ok = true;
  if (patchedSeed !== seedText) {
    console.error('self-test FAILED: seed file round-trip is not byte-identical.');
    ok = false;
  }
  if (patchedDemo !== demoText) {
    console.error('self-test FAILED: DEMO file round-trip is not byte-identical.');
    ok = false;
  }
  if (changes.length > 0) {
    console.error('self-test FAILED: round-trip produced spurious changes:', changes);
    ok = false;
  }

  if (ok) {
    console.log(`self-test OK — round-tripped ${packages.length} packages + ${addons.length} addons byte-identical, no spurious changes.`);
    process.exit(0);
  }
  process.exit(1);
}

// ─── 6. Entrypoint ────────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes('--self-test')) {
    selfTest();
    return;
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY).');
    process.exit(1);
  }

  const [packages, addons] = await Promise.all([
    fetchTable(url, anonKey, 'packages'),
    fetchTable(url, anonKey, 'addons'),
  ]);

  const now = new Date().toISOString();
  const dateStamp = now.slice(0, 10);

  if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });
  const backupPath = path.join(BACKUPS_DIR, `catalogue-${dateStamp}.sql`);
  writeFileSync(backupPath, buildBackupSql(packages, addons, now));
  console.log(`Wrote backup snapshot: ${path.relative(ROOT, backupPath)}`);

  const seedText = readFileSync(SEED_PATH, 'utf8');
  const patchedSeed = patchSeedFile(seedText, packages, addons);
  if (patchedSeed !== seedText) {
    writeFileSync(SEED_PATH, patchedSeed);
    console.log(`Patched ${path.relative(ROOT, SEED_PATH)}`);
  }

  const demoText = readFileSync(DEMO_PATH, 'utf8');
  const patchedDemo = patchDemoFile(demoText, packages);
  if (patchedDemo !== demoText) {
    writeFileSync(DEMO_PATH, patchedDemo);
    console.log(`Patched ${path.relative(ROOT, DEMO_PATH)}`);
  }

  if (changes.length > 0) {
    console.log('\nScalar field changes synced:');
    for (const c of changes) console.log(`  - ${c}`);
  } else {
    console.log('\nNo scalar field drift detected.');
  }

  if (warnings.length > 0) {
    console.log('\nNeeds a human — text/array fields changed live and were NOT auto-patched:');
    for (const w of warnings) console.log(`  ! ${w}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
