import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VIDEO_ROOT = join(ROOT, 'public', 'videos');
const HLS_ROOT = join(VIDEO_ROOT, 'hls');
const MANIFEST_PATH = join(HLS_ROOT, 'manifest.json');

const RAW_PLAYLIST = [
  { id: 'clip-01', file: 'Facetune1701A602-8C92-46B2-824C-D15D3072F2DD.MP4', manualRotation: -90 },
  { id: 'clip-02', file: 'Facetune1FBB9BB3-4753-4176-AD6A-7455BFB9663B 2.MOV' },
  { id: 'clip-03', file: 'Facetune1FBB9BB3-4753-4176-AD6A-7455BFB9663B 2-1.MOV', aliasOf: 'clip-02' },
  { id: 'clip-04', file: 'Facetune1FBB9BB3-4753-4176-AD6A-7455BFB9663B.MP4' },
  { id: 'clip-05', file: 'Facetune20A2EFD1-9628-49E8-B80E-6F6D763E9D91.MP4' },
  { id: 'clip-06', file: 'Facetune441554D1-A128-4A78-86C6-0D62D5FBB2BF.MP4', manualRotation: -90 },
  { id: 'clip-07', file: 'Facetune84157277-84BE-415F-A72F-84390080BFFC.MP4' },
  { id: 'clip-08', file: 'Facetune98AC2677-034D-41CC-925F-C007B91FA0B9.MP4', manualRotation: -90 },
  { id: 'clip-09', file: 'Facetune9E6EFC66-D13D-4947-B4A0-384F6DB307E8.MP4', manualRotation: -90 },
  { id: 'clip-10', file: 'FacetuneAF261190-F330-41F2-A949-E7A2309878D7.MP4', manualRotation: -90 },
  { id: 'clip-11', file: 'FacetuneC2E398C2-2693-41E8-A470-F83383868F22.MP4', manualRotation: -90 },
  { id: 'clip-12', file: 'IMG_1240.mov' },
  { id: 'clip-13', file: 'ips-C5A611FC-96A2-4DE0-AD55-FE4029EEEF8B.mp4' },
  { id: 'clip-14', file: 'video-output-096D7612-301B-47B2-9F19-664C48D28219-1.mov', manualRotation: -90 },
  { id: 'clip-15', file: 'video-output-22C3FCAE-F436-4A2F-AE07-B7DEDB02D25C-1.MOV' },
  { id: 'clip-16', file: 'video-output-5EF1F5E7-8CB9-4AFA-9201-C5EFA80A59C7-1.MOV' },
  { id: 'clip-17', file: 'video-output-6853DF27-8338-4B51-887A-5C63230A1284-1.MOV' },
  { id: 'clip-18', file: 'video-output-7DC0D162-E3D2-4C12-BE4B-830B3E5CFDE0-1.MOV' },
  { id: 'clip-19', file: 'video-output-BB3F55B8-A1CD-470D-8A64-694CF3E54B59-1.MOV' },
];

const LADDER = [
  { label: '360p', shortEdge: 360, videoBitrate: 780_000, audioBitrate: '96k' },
  { label: '540p', shortEdge: 540, videoBitrate: 1_350_000, audioBitrate: '112k' },
  { label: '720p', shortEdge: 720, videoBitrate: 2_250_000, audioBitrate: '128k' },
];

function assertInside(parent, child) {
  const parentPath = resolve(parent);
  const childPath = resolve(child);
  if (!childPath.startsWith(parentPath)) {
    throw new Error(`Refusing to write outside ${parentPath}: ${childPath}`);
  }
}

function cleanTitle(file) {
  return file
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function even(value) {
  return Math.max(2, Math.round(value / 2) * 2);
}

function parseFrameRate(value) {
  if (!value || value === '0/0') return 30;
  const [num, den] = value.split('/').map(Number);
  if (!num || !den) return Number(value) || 30;
  return num / den;
}

function rotationFrom(stream) {
  const raw = stream.tags?.rotate ?? stream.side_data_list?.find((item) => item.rotation != null)?.rotation ?? 0;
  return Number(raw) || 0;
}

function normalizeRotation(value) {
  const normalized = ((Number(value) % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
}

function combinedRotation(stream, manualRotation = 0) {
  return normalizeRotation(rotationFrom(stream) + manualRotation);
}

function displaySize(stream, manualRotation = 0) {
  const rotation = Math.abs(combinedRotation(stream, manualRotation)) % 180;
  if (rotation === 90) {
    return { width: stream.height, height: stream.width };
  }
  return { width: stream.width, height: stream.height };
}

function rotationFilters(rotation) {
  const normalized = normalizeRotation(rotation);
  if (normalized === 90) return ['transpose=clock'];
  if (normalized === -90) return ['transpose=cclock'];
  if (Math.abs(normalized) === 180) return ['hflip', 'vflip'];
  return [];
}

function makeRenditions(meta) {
  const shortEdge = Math.min(meta.width, meta.height);
  const seen = new Set();
  const renditions = [];

  for (const rung of LADDER) {
    const scale = Math.min(1, rung.shortEdge / shortEdge);
    const width = even(meta.width * scale);
    const height = even(meta.height * scale);
    const key = `${width}x${height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    renditions.push({
      label: rung.label,
      width,
      height,
      videoBitrate: rung.videoBitrate,
      audioBitrate: rung.audioBitrate,
      bandwidth: rung.videoBitrate + 160_000,
    });
  }

  return renditions;
}

function masterPlaylist(renditions) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (const rendition of renditions) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bandwidth},RESOLUTION=${rendition.width}x${rendition.height}`,
      `${rendition.label}/index.m3u8`,
    );
  }
  return `${lines.join('\n')}\n`;
}

async function probe(inputPath, manualRotation = 0) {
  const { stdout } = await execFileAsync(
    ffprobeStatic.path,
    ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', inputPath],
    { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
  );
  const data = JSON.parse(stdout);
  const video = data.streams.find((stream) => stream.codec_type === 'video');
  const audio = data.streams.some((stream) => stream.codec_type === 'audio');
  if (!video) throw new Error(`No video stream in ${inputPath}`);

  const rotation = combinedRotation(video, manualRotation);
  const size = displaySize(video, manualRotation);
  return {
    ...size,
    rawWidth: video.width,
    rawHeight: video.height,
    metadataRotation: rotationFrom(video),
    manualRotation,
    rotation,
    duration: Number(video.duration ?? data.format?.duration ?? 0),
    fps: parseFrameRate(video.avg_frame_rate),
    hasAudio: audio,
  };
}

async function runFfmpeg(args, label) {
  await execFileAsync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  }).catch((error) => {
    const stderr = error.stderr ? `\n${error.stderr}` : '';
    throw new Error(`${label} failed.${stderr}`);
  });
}

async function encodeRendition(inputPath, outputDir, rendition, meta) {
  await mkdir(outputDir, { recursive: true });
  const segmentPattern = join(outputDir, 'segment-%04d.ts');
  const playlistPath = join(outputDir, 'index.m3u8');
  const fps = 30;
  const gop = Math.max(48, Math.round(fps * 2));
  const filter = [
    ...rotationFilters(meta.rotation),
    `fps=${fps}`,
    `scale=${rendition.width}:${rendition.height}:flags=lanczos`,
    'setsar=1',
  ].join(',');

  const args = [
    '-noautorotate',
    '-i', inputPath,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-vf', filter,
    '-c:v', 'libx264',
    '-profile:v', 'main',
    '-preset', 'medium',
    '-crf', '23',
    '-maxrate', String(rendition.videoBitrate),
    '-bufsize', String(rendition.videoBitrate * 2),
    '-g', String(gop),
    '-keyint_min', String(gop),
    '-sc_threshold', '0',
    '-pix_fmt', 'yuv420p',
  ];

  if (meta.hasAudio) {
    args.push('-c:a', 'aac', '-b:a', rendition.audioBitrate, '-ac', '2', '-ar', '48000');
  } else {
    args.push('-an');
  }

  args.push(
    '-hls_time', '4',
    '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments',
    '-hls_segment_filename', segmentPattern,
    playlistPath,
  );

  await runFfmpeg(args, `${rendition.label} encode`);
}

async function encodePoster(inputPath, outputPath, meta) {
  const longEdge = Math.max(meta.width, meta.height);
  const scale = Math.min(1, 960 / longEdge);
  const width = even(meta.width * scale);
  const height = even(meta.height * scale);
  await runFfmpeg([
    '-ss', '1',
    '-noautorotate',
    '-i', inputPath,
    '-frames:v', '1',
    '-vf', [
      ...rotationFilters(meta.rotation),
      `scale=${width}:${height}:flags=lanczos`,
      'setsar=1',
    ].join(','),
    '-q:v', '3',
    outputPath,
  ], 'poster extraction');
}

async function encodeClip(entry, processed) {
  const outputId = entry.aliasOf ?? entry.id;
  if (processed.has(outputId)) return processed.get(outputId);

  const inputPath = join(VIDEO_ROOT, entry.file);
  if (!existsSync(inputPath)) throw new Error(`Missing raw video: ${entry.file}`);
  const outputDir = join(HLS_ROOT, outputId);
  assertInside(HLS_ROOT, outputDir);
  await mkdir(outputDir, { recursive: true });

  const meta = await probe(inputPath, entry.manualRotation ?? 0);
  const original = await stat(inputPath);
  const renditions = makeRenditions(meta);

  console.log(`\n${entry.id} ${entry.file}`);
  console.log(
    `  display ${meta.width}x${meta.height}, raw ${meta.rawWidth}x${meta.rawHeight}, ` +
    `metadata rotate ${meta.metadataRotation}, manual ${meta.manualRotation}, baked ${meta.rotation}, ${meta.duration.toFixed(1)}s`,
  );

  for (const rendition of renditions) {
    console.log(`  -> ${rendition.label} ${rendition.width}x${rendition.height}`);
    await encodeRendition(inputPath, join(outputDir, rendition.label), rendition, meta);
  }

  await encodePoster(inputPath, join(outputDir, 'poster.jpg'), meta);
  await writeFile(join(outputDir, 'master.m3u8'), masterPlaylist(renditions), 'utf8');

  const stream = {
    outputId,
    hls: `videos/hls/${outputId}/master.m3u8`,
    poster: `videos/hls/${outputId}/poster.jpg`,
    duration: meta.duration,
    width: meta.width,
    height: meta.height,
    originalSize: original.size,
    renditions: renditions.map(({ label, width, height, bandwidth }) => ({ label, width, height, bandwidth })),
  };

  processed.set(outputId, stream);
  return stream;
}

async function main() {
  assertInside(VIDEO_ROOT, HLS_ROOT);
  await rm(HLS_ROOT, { recursive: true, force: true });
  await mkdir(HLS_ROOT, { recursive: true });

  const processed = new Map();
  const items = [];

  for (const [index, entry] of RAW_PLAYLIST.entries()) {
    const stream = await encodeClip(entry, processed);
    const originalPath = join(VIDEO_ROOT, entry.file);
    const original = await stat(originalPath);
    items.push({
      id: entry.id,
      order: index + 1,
      title: cleanTitle(entry.file),
      sourceFile: entry.file,
      originalExt: entry.file.split('.').pop().toLowerCase(),
      duplicateOf: entry.aliasOf ?? null,
      manualRotation: entry.manualRotation ?? 0,
      originalSize: original.size,
      ...stream,
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    player: 'hls',
    items,
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`\nWrote ${items.length} ordered items to ${MANIFEST_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
