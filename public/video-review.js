const MANIFEST_URL = 'videos/hls/manifest.json';
const LARGE_SOURCE_BYTES = 25 * 1024 * 1024;

let videos = [];
let hls = null;
let nativeHls = false;

const state = {
  active: 0,
  filter: 'all',
  query: '',
};

const player = document.querySelector('#player');
const playlist = document.querySelector('#playlist');
const search = document.querySelector('#search');
const filters = Array.from(document.querySelectorAll('.filter'));
const visibleCount = document.querySelector('#visibleCount');
const empty = document.querySelector('#empty');
const currentTitle = document.querySelector('#currentTitle');
const currentMeta = document.querySelector('#currentMeta');
const currentNumber = document.querySelector('#currentNumber');
const totalNumber = document.querySelector('#totalNumber');
const status = document.querySelector('#status');
const prevBtn = document.querySelector('#prevBtn');
const nextBtn = document.querySelector('#nextBtn');
const muteBtn = document.querySelector('#muteBtn');
const loopBtn = document.querySelector('#loopBtn');
const qualitySelect = document.querySelector('#qualitySelect');

function pad(num) {
  return String(num).padStart(2, '0');
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return 'size pending';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'metadata pending';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function createPill(text) {
  const pill = document.createElement('span');
  pill.className = 'pill';
  pill.textContent = text;
  return pill;
}

function qualityLabel(level) {
  if (!level) return 'Auto';
  const shortSide = Math.min(level.width, level.height);
  return `${shortSide}p`;
}

function renditionSummary(video) {
  return (video.renditions ?? [])
    .map((rendition) => rendition.label)
    .join(' / ');
}

function normalizeVideo(item) {
  return {
    ...item,
    index: item.order - 1,
    title: item.title || item.sourceFile,
    originalExt: (item.originalExt || item.sourceFile.split('.').pop() || '').toLowerCase(),
  };
}

function matches(video) {
  const q = state.query;
  const queryMatch = !q
    || video.title.toLowerCase().includes(q)
    || video.sourceFile.toLowerCase().includes(q);
  if (!queryMatch) return false;
  if (state.filter === 'all') return true;
  if (state.filter === 'large') return video.originalSize >= LARGE_SOURCE_BYTES;
  return video.originalExt === state.filter;
}

function filteredVideos() {
  return videos.filter(matches);
}

function renderCurrent() {
  const video = videos[state.active];
  if (!video) return;
  const activeLevel = hls && hls.currentLevel >= 0 ? hls.levels[hls.currentLevel] : null;
  const autoLevel = hls && hls.loadLevel >= 0 ? hls.levels[hls.loadLevel] : null;
  const mode = hls
    ? (activeLevel ? qualityLabel(activeLevel) : `Auto${autoLevel ? ` -> ${qualityLabel(autoLevel)}` : ''}`)
    : (nativeHls ? 'Native HLS' : 'HLS');

  currentNumber.textContent = pad(state.active + 1);
  currentTitle.textContent = video.title;
  currentMeta.replaceChildren(
    createPill('HLS'),
    createPill(`${video.originalExt.toUpperCase()} source`),
    createPill(renditionSummary(video)),
    createPill(mode),
    createPill(formatDuration(video.duration || player.duration)),
  );
}

function renderPlaylist() {
  const visible = filteredVideos();
  playlist.replaceChildren();
  visibleCount.textContent = `${visible.length} / ${videos.length}`;
  empty.dataset.visible = visible.length === 0 ? 'true' : 'false';

  for (const video of visible) {
    const button = document.createElement('button');
    button.className = 'item';
    button.type = 'button';
    button.setAttribute('aria-current', video.index === state.active ? 'true' : 'false');
    button.addEventListener('click', () => selectVideo(video.index, true));

    const index = document.createElement('span');
    index.className = 'index';
    index.textContent = pad(video.index + 1);

    const copy = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'item-name';
    name.textContent = video.title;
    const meta = document.createElement('span');
    meta.className = 'item-meta';
    meta.textContent = `${video.originalExt.toUpperCase()} -> HLS - ${renditionSummary(video)} - ${formatSize(video.originalSize)}`;
    copy.append(name, meta);

    const format = document.createElement('span');
    format.className = 'format';
    format.textContent = video.originalExt.toUpperCase();

    button.append(index, copy, format);
    playlist.append(button);
  }

  const active = playlist.querySelector('[aria-current="true"]');
  active?.scrollIntoView({ block: 'nearest' });
}

function destroyHls() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
  nativeHls = false;
  player.removeAttribute('src');
  player.load();
}

function renderQualityOptions() {
  qualitySelect.replaceChildren();
  const auto = document.createElement('option');
  auto.value = 'auto';
  auto.textContent = hls ? 'Auto' : (nativeHls ? 'Auto HLS' : 'Auto');
  qualitySelect.append(auto);

  if (!hls) {
    qualitySelect.disabled = true;
    return;
  }

  hls.levels.forEach((level, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = qualityLabel(level);
    qualitySelect.append(option);
  });

  qualitySelect.disabled = false;
  qualitySelect.value = hls.currentLevel >= 0 ? String(hls.currentLevel) : 'auto';
}

function playIfRequested(shouldPlay) {
  if (!shouldPlay) return;
  player.play().catch(() => {
    status.textContent = 'Playback is waiting for a browser gesture.';
  });
}

function attachHls(video, shouldPlay) {
  destroyHls();
  player.poster = video.poster || '';
  renderQualityOptions();

  const HlsRuntime = window.Hls;
  if (HlsRuntime?.isSupported()) {
    hls = new HlsRuntime({
      capLevelToPlayerSize: true,
      enableWorker: true,
      maxBufferLength: 24,
      startLevel: -1,
    });
    hls.loadSource(video.hls);
    hls.attachMedia(player);
    hls.on(HlsRuntime.Events.MANIFEST_PARSED, () => {
      status.textContent = '';
      renderQualityOptions();
      renderCurrent();
      playIfRequested(shouldPlay);
    });
    hls.on(HlsRuntime.Events.LEVEL_SWITCHED, () => {
      renderQualityOptions();
      renderCurrent();
    });
    hls.on(HlsRuntime.Events.ERROR, (_event, data) => {
      if (!data?.fatal) return;
      status.textContent = 'The adaptive stream paused after a playback error.';
      if (data.type === HlsRuntime.ErrorTypes.NETWORK_ERROR) hls.startLoad();
      else if (data.type === HlsRuntime.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
    });
    return;
  }

  if (player.canPlayType('application/vnd.apple.mpegurl')) {
    nativeHls = true;
    player.src = video.hls;
    renderQualityOptions();
    playIfRequested(shouldPlay);
    return;
  }

  status.textContent = 'This browser needs HLS support to stream these videos.';
}

function selectVideo(index, shouldPlay = false) {
  const video = videos[index] ?? videos[0];
  if (!video) return;
  state.active = video.index;
  status.textContent = 'Loading adaptive stream...';
  attachHls(video, shouldPlay);
  renderCurrent();
  renderPlaylist();
}

function refreshConstrainedList() {
  const visible = filteredVideos();
  if (visible.length > 0 && !visible.some((video) => video.index === state.active)) {
    selectVideo(visible[0].index);
    return;
  }
  renderPlaylist();
}

function move(delta) {
  const visible = filteredVideos();
  if (visible.length === 0) return;
  const currentVisibleIndex = visible.findIndex((video) => video.index === state.active);
  const base = currentVisibleIndex >= 0 ? currentVisibleIndex : 0;
  const next = visible[(base + delta + visible.length) % visible.length];
  selectVideo(next.index, true);
}

function setFilter(filter) {
  state.filter = filter;
  for (const button of filters) {
    button.setAttribute('aria-pressed', button.dataset.filter === filter ? 'true' : 'false');
  }
  refreshConstrainedList();
}

async function loadManifest() {
  status.textContent = 'Loading video manifest...';
  const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Manifest request failed: ${response.status}`);
  const manifest = await response.json();
  videos = manifest.items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(normalizeVideo);
  totalNumber.textContent = pad(videos.length);
  renderPlaylist();
  selectVideo(0);
}

search.addEventListener('input', () => {
  state.query = search.value.trim().toLowerCase();
  refreshConstrainedList();
});

for (const button of filters) {
  button.addEventListener('click', () => setFilter(button.dataset.filter));
}

prevBtn.addEventListener('click', () => move(-1));
nextBtn.addEventListener('click', () => move(1));
muteBtn.addEventListener('click', () => {
  player.muted = !player.muted;
  muteBtn.setAttribute('aria-pressed', player.muted ? 'true' : 'false');
  muteBtn.textContent = player.muted ? 'Muted' : 'Mute';
});
loopBtn.addEventListener('click', () => {
  player.loop = !player.loop;
  loopBtn.setAttribute('aria-pressed', player.loop ? 'true' : 'false');
});
qualitySelect.addEventListener('change', () => {
  if (!hls) return;
  hls.currentLevel = qualitySelect.value === 'auto' ? -1 : Number(qualitySelect.value);
  renderCurrent();
});

player.addEventListener('loadedmetadata', renderCurrent);
player.addEventListener('ended', () => {
  if (!player.loop) move(1);
});

document.addEventListener('keydown', (event) => {
  if (event.target === search || event.target === qualitySelect) return;
  if (event.key === 'ArrowLeft') move(1);
  if (event.key === 'ArrowRight') move(-1);
  if (event.key === ' ') {
    event.preventDefault();
    if (player.paused) player.play();
    else player.pause();
  }
});

loadManifest().catch((error) => {
  console.error(error);
  status.textContent = 'The adaptive video manifest is not ready yet.';
  qualitySelect.disabled = true;
});
