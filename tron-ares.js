// =====================================================
// TRON ARES IPTV PLAYER - JAVASCRIPT COMPLET
// VERSION RÉVISÉE + SCROLL AUTO NEXT/PREV
// =====================================================

// --------- DATA MODEL ---------
const channels = [];      // Liste M3U principale
const frChannels = [];    // Liste M3U FR
const iframeItems = [];   // Overlays / iFrames

let currentIndex = -1;
let currentFrIndex = -1;
let currentIframeIndex = -1;
let currentListType = null; // 'channels' | 'fr' | 'iframe'

let overlayMode = false;

let hlsInstance = null;
let dashInstance = null;

let currentEntry = null;
let externalFallbackTried = false;

// --------- DOM REFS ---------
const videoEl = document.getElementById('videoEl');
const iframeOverlay = document.getElementById('iframeOverlay');
const iframeEl = document.getElementById('iframeEl');

const channelFrListEl = document.getElementById('channelFrList');
const channelListEl = document.getElementById('channelList');
const iframeListEl = document.getElementById('iframeList');
const favoriteListEl = document.getElementById('favoriteList');

const statusPill = document.getElementById('statusPill');
const npLogo = document.getElementById('npLogo');
const npTitle = document.getElementById('npTitle');
const npSub = document.getElementById('npSub');
const npBadge = document.getElementById('npBadge');

const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');

const urlInput = document.getElementById('urlInput');
const loadUrlBtn = document.getElementById('loadUrlBtn');
const fileInput = document.getElementById('fileInput');
const openFileBtn = document.getElementById('openFileBtn');
const fileNameLabel = document.getElementById('fileNameLabel');

const iframeTitleInput = document.getElementById('iframeTitleInput');
const iframeUrlInput = document.getElementById('iframeUrlInput');
const addIframeBtn = document.getElementById('addIframeBtn');

const exportM3uJsonBtn = document.getElementById('exportM3uJsonBtn');
const exportIframeJsonBtn = document.getElementById('exportIframeJsonBtn');
const importJsonBtn = document.getElementById('importJsonBtn');
const jsonArea = document.getElementById('jsonArea');

const toggleOverlayBtn = document.getElementById('toggleOverlayBtn');
const fullPageBtn = document.getElementById('fullPageBtn');
const playerContainer = document.getElementById('playerContainer');
const appShell = document.getElementById('appShell');

const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

const fxToggleBtn = document.getElementById('fxToggleBtn');
const pipToggleBtn = document.getElementById('pipToggleBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// =====================================================
// UTILS
// =====================================================

function setStatus(text) {
  statusPill.textContent = text;
}

function normalizeName(name) {
  return name || 'Flux sans titre';
}

function deriveLogoFromName(name) {
  const initial = (name || '?').trim()[0] || '?';
  return { type: 'letter', value: initial.toUpperCase() };
}

function isProbablyHls(url) {
  return /\.m3u8(\?|$)/i.test(url);
}

function isProbablyDash(url) {
  return /\.mpd(\?|$)/i.test(url);
}

function isProbablyPlaylist(url) {
  return /\.m3u8?(\?|$)/i.test(url);
}

function isYoutubeUrl(url) {
  return /youtu\.be|youtube\.com/i.test(url);
}

function youtubeToEmbed(url) {
  try {
    const u = new URL(url, window.location.href);
    let id = null;
    if (u.hostname.includes('youtu.be')) id = u.pathname.replace('/', '');
    else id = u.searchParams.get('v');

    return id ? `https://www.youtube.com/embed/${id}` : url;
  } catch {
    return url;
  }
}

// =====================================================
// RENDERING
// =====================================================

function renderLists() {
  renderChannelList();
  renderChannelFrList();
  renderIframeList();
  renderFavoritesList();
}

function renderChannelFrList() {
  channelFrListEl.innerHTML = '';
  frChannels.forEach((ch, idx) => {
    const el = createChannelElement(ch, idx, 'fr');
    channelFrListEl.appendChild(el);
  });
}

function renderChannelList() {
  channelListEl.innerHTML = '';
  channels.forEach((ch, idx) => {
    const el = createChannelElement(ch, idx, 'channels');
    channelListEl.appendChild(el);
  });
}

function renderIframeList() {
  iframeListEl.innerHTML = '';
  iframeItems.forEach((item, idx) => {
    const el = createChannelElement(item, idx, 'iframe');
    iframeListEl.appendChild(el);
  });
}

function renderFavoritesList() {
  favoriteListEl.innerHTML = '';

  const favs = [
    ...channels.filter(c => c.isFavorite),
    ...frChannels.filter(c => c.isFavorite),
    ...iframeItems.filter(i => i.isFavorite)
  ];

  favs.forEach((entry, idx) => {
    const el = createChannelElement(
      entry,
      idx,
      entry.listType || (entry.isIframe ? 'iframe' : 'channels')
    );
    favoriteListEl.appendChild(el);
  });
}

// =====================================================
// CREATE CHANNEL ELEMENT
// =====================================================

function createChannelElement(entry, index, sourceType) {
  const li = document.createElement('div');
  li.className = 'channel-item';
  li.dataset.index = index;
  li.dataset.type = sourceType;

  // MARK ACTIVE ITEM
  if (sourceType === 'channels' && currentListType === 'channels' && index === currentIndex)
    li.classList.add('active');
  if (sourceType === 'fr' && currentListType === 'fr' && index === currentFrIndex)
    li.classList.add('active');
  if (sourceType === 'iframe' && currentListType === 'iframe' && index === currentIframeIndex)
    li.classList.add('active');

  // LOGO
  const logoDiv = document.createElement('div');
  logoDiv.className = 'channel-logo';

  if (entry.logo && entry.logo.type === 'image') {
    const img = document.createElement('img');
    img.src = entry.logo.value;
    img.alt = entry.name;
    logoDiv.appendChild(img);
  } else {
    logoDiv.textContent = entry.logo?.value ?? deriveLogoFromName(entry.name).value;
  }

  // META
  const metaDiv = document.createElement('div');
  metaDiv.className = 'channel-meta';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'channel-title';
  titleDiv.textContent = normalizeName(entry.name);

  const subDiv = document.createElement('div');
  subDiv.className = 'channel-sub';
  subDiv.textContent = entry.group || (entry.isIframe ? 'Overlay / iFrame' : 'Flux M3U');

  const tagsDiv = document.createElement('div');
  tagsDiv.className = 'channel-tags';

  const tag = document.createElement('div');
  tag.className = 'tag-chip' + (entry.isIframe ? ' tag-chip--iframe' : '');
  tag.textContent = entry.isIframe ? 'IFRAME' : 'STREAM';
  tagsDiv.appendChild(tag);

  if (isYoutubeUrl(entry.url)) {
    const ytTag = document.createElement('div');
    ytTag.className = 'tag-chip tag-chip--iframe';
    ytTag.textContent = 'YOUTUBE';
    tagsDiv.appendChild(ytTag);
  }

  metaDiv.appendChild(titleDiv);
  metaDiv.appendChild(subDiv);
  metaDiv.appendChild(tagsDiv);

  // ACTIONS
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'channel-actions';

  const favBtn = document.createElement('button');
  favBtn.className = 'icon-btn';
  favBtn.innerHTML = '★';
  favBtn.title = 'Ajouter / enlever des favoris';

  favBtn.dataset.fav = entry.isFavorite ? 'true' : 'false';

  favBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    entry.isFavorite = !entry.isFavorite;
    favBtn.dataset.fav = entry.isFavorite ? 'true' : 'false';
    renderFavoritesList();
  });

  const ovBtn = document.createElement('button');
  ovBtn.className = 'icon-btn';
  ovBtn.innerHTML = '⧉';
  ovBtn.title = 'Lire en overlay iFrame';
  ovBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    playEntryAsOverlay(entry);
  });

  actionsDiv.appendChild(favBtn);
  actionsDiv.appendChild(ovBtn);

  li.appendChild(logoDiv);
  li.appendChild(metaDiv);
  li.appendChild(actionsDiv);

  // CLICK
  li.addEventListener('click', () => {
    if (sourceType === 'channels') playChannel(index);
    else if (sourceType === 'fr') playFrChannel(index);
    else if (sourceType === 'iframe') playIframe(index);
  });

  return li;
}

// =====================================================
// NOW PLAYING BAR
// =====================================================

function updateNowPlaying(entry, modeLabel) {
  if (!entry) {
    npLogo.textContent = '';
    npTitle.textContent = 'Aucune chaîne sélectionnée';
    npSub.textContent = 'Choisissez une chaîne dans la liste';
    npBadge.textContent = 'IDLE';
    return;
  }

  const logo = entry.logo || deriveLogoFromName(entry.name);
  npLogo.innerHTML = '';

  if (logo.type === 'image') {
    const img = document.createElement('img');
    img.src = logo.value;
    img.alt = entry.name;
    npLogo.appendChild(img);
  } else npLogo.textContent = logo.value;

  npTitle.textContent = normalizeName(entry.name);
  npSub.textContent = entry.group || (entry.isIframe ? 'Overlay / iFrame' : 'Flux M3U');
  npBadge.textContent = modeLabel;
}
// =====================================================
// PLAYER LOGIC
// =====================================================

function destroyHls() {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
}

function destroyDash() {
  if (dashInstance) {
    try { dashInstance.reset(); } catch (e) {}
    dashInstance = null;
  }
}

function showVideo() {
  overlayMode = false;
  iframeOverlay.classList.add('hidden');
  iframeEl.src = 'about:blank';
  videoEl.style.visibility = 'visible';
}

function showIframe() {
  overlayMode = true;
  iframeOverlay.classList.remove('hidden');
  videoEl.pause();
  videoEl.style.visibility = 'hidden';
}

function playEntryAsOverlay(entry) {
  if (!entry || !entry.url) return;

  showIframe();
  let url = entry.url;

  if (isYoutubeUrl(url)) {
    url = youtubeToEmbed(url);
    url += (url.includes('?') ? '&' : '?') + 'autoplay=1&mute=1';
  }

  iframeEl.src = url;
  updateNowPlaying(entry, 'IFRAME');
  setStatus('Overlay iFrame actif');
}

function fallbackToExternalPlayer(entry) {
  if (!entry || !entry.url) return;

  showIframe();
  const base = 'https://vsalema.github.io/play/?';
  iframeEl.src = base + encodeURIComponent(entry.url);

  updateNowPlaying(entry, 'EXT-PLAYER');
  setStatus('Lecture via lecteur externe');
}

function playUrl(entry) {
  if (!entry || !entry.url) return;

  currentEntry = entry;
  externalFallbackTried = false;

  const url = entry.url;

  // Fallback for RTP or SMIL
  if (/rtp\.pt/i.test(url) || /smil:/i.test(url)) {
    fallbackToExternalPlayer(entry);
    return;
  }

  // Overlay / YouTube
  if (entry.isIframe || isYoutubeUrl(url)) {
    playEntryAsOverlay(entry);
    return;
  }

  // Normal video
  showVideo();
  destroyHls();
  destroyDash();

  videoEl.removeAttribute('src');
  videoEl.load();

  let modeLabel = 'VIDEO';

  if (isProbablyDash(url) && window.dashjs) {
    try {
      dashInstance = dashjs.MediaPlayer().create();
      dashInstance.initialize(videoEl, url, true);
      modeLabel = 'DASH';

      dashInstance.on(dashjs.MediaPlayer.events.ERROR, e => {
        setStatus('Erreur DASH');
      });
    } catch (e) {
      modeLabel = 'VIDEO';
      videoEl.src = url;
    }
  } else if (isProbablyHls(url) && window.Hls && Hls.isSupported()) {
    hlsInstance = new Hls();
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(videoEl);
    modeLabel = 'HLS';

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (!externalFallbackTried && data.fatal) {
        externalFallbackTried = true;
        fallbackToExternalPlayer(entry);
      }
    });
  } else {
    videoEl.src = url;
  }

  videoEl.play().catch(() => {});
  updateNowPlaying(entry, modeLabel);
  setStatus('Lecture en cours');
}

// =====================================================
// PLAYERS FOR EACH LIST
// =====================================================

function playChannel(index) {
  if (index < 0 || index >= channels.length) return;
  currentListType = 'channels';
  currentIndex = index;

  renderChannelList();
  playUrl(channels[index]);
  scrollToActiveItem();
}

function playFrChannel(index) {
  if (index < 0 || index >= frChannels.length) return;
  currentListType = 'fr';
  currentFrIndex = index;

  renderChannelFrList();
  playUrl(frChannels[index]);
  scrollToActiveItem();
}

function playIframe(index) {
  if (index < 0 || index >= iframeItems.length) return;
  currentListType = 'iframe';
  currentIframeIndex = index;

  renderIframeList();
  playUrl(iframeItems[index]);
  scrollToActiveItem();
}

// =====================================================
// NEXT / PREV FIXÉ AVEC SCROLL
// =====================================================

function playNext() {
  if (currentListType === 'fr') {
    if (!frChannels.length) return;
    playFrChannel((currentFrIndex + 1) % frChannels.length);

  } else if (currentListType === 'iframe') {
    if (!iframeItems.length) return;
    playIframe((currentIframeIndex + 1) % iframeItems.length);

  } else {
    if (!channels.length) return;
    playChannel((currentIndex + 1) % channels.length);
  }

  scrollToActiveItem();
}

function playPrev() {
  if (currentListType === 'fr') {
    if (!frChannels.length) return;
    playFrChannel((currentFrIndex - 1 + frChannels.length) % frChannels.length);

  } else if (currentListType === 'iframe') {
    if (!iframeItems.length) return;
    playIframe((currentIframeIndex - 1 + iframeItems.length) % iframeItems.length);

  } else {
    if (!channels.length) return;
    playChannel((currentIndex - 1 + channels.length) % channels.length);
  }

  scrollToActiveItem();
}

// =====================================================
// M3U PARSER
// =====================================================

function parseM3U(content, listType = 'channels', defaultGroup = 'Playlist') {
  const lines = content.split(/\r?\n/);
  const results = [];
  let lastInf = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#EXTM3U')) continue;

    if (line.startsWith('#EXTINF')) {
      lastInf = line;
      continue;
    }

    if (line.startsWith('#')) continue;

    // URL
    const url = line;
    let name = 'Sans titre';
    let logo = null;
    let group = defaultGroup;

    if (lastInf) {
      const nameMatch = lastInf.split(',').slice(-1)[0].trim();
      if (nameMatch) name = nameMatch;

      const logoMatch = lastInf.match(/tvg-logo="([^"]+)"/i);
      if (logoMatch) logo = { type: 'image', value: logoMatch[1] };

      const groupMatch = lastInf.match(/group-title="([^"]+)"/i);
      if (groupMatch) group = groupMatch[1];
    }

    results.push({
      id: listType + '-ch-' + (results.length + 1),
      name,
      url,
      logo: logo || deriveLogoFromName(name),
      group,
      isIframe: isYoutubeUrl(url),
      isFavorite: false,
      listType
    });

    lastInf = null;
  }

  return results;
}

// =====================================================
// LOADERS
// =====================================================

async function loadFromUrl(url) {
  if (!url) return;

  try {
    const res = await fetch(url);
    const text = await res.text();

    if (text.trim().startsWith('#EXTM3U')) {
      const parsed = parseM3U(text, 'channels');
      channels.push(...parsed);
      renderLists();
    }
  } catch (e) {
    setStatus('Erreur (CORS ?)');
  }
}

async function loadFrM3u(url) {
  try {
    const res = await fetch(url);
    const text = await res.text();

    if (text.startsWith('#EXTM3U')) {
      const parsed = parseM3U(text, 'fr', 'FR');
      frChannels.push(...parsed);
      renderChannelFrList();
    }
  } catch (e) {
    console.error('Erreur FR', e);
  }
}

function loadFromFile(file) {
  if (!file) return;

  const reader = new FileReader();

  if (/\.m3u/i.test(file.name)) {
    reader.onload = () => {
      const parsed = parseM3U(reader.result, 'channels', 'Local');
      channels.push(...parsed);
      renderLists();
    };
    reader.readAsText(file);
  }
}

// =====================================================
// EVENTS
// =====================================================

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const tab = btn.dataset.tab;
    document.querySelectorAll('.list').forEach(l => l.classList.remove('active'));

    if (tab === 'channels') channelListEl.classList.add('active');
    if (tab === 'fr') channelFrListEl.classList.add('active');
    if (tab === 'iframes') iframeListEl.classList.add('active');
    if (tab === 'favorites') favoriteListEl.classList.add('active');

    scrollToActiveItem();
  });
});

nextBtn.addEventListener('click', playNext);
prevBtn.addEventListener('click', playPrev);
// =====================================================
// SCROLL AUTO — FONCTION CENTRALE
// =====================================================

function scrollToActiveItem() {
  const activeTab = document.querySelector(".tab-btn.active")?.dataset.tab;

  let listEl = null;

  switch (activeTab) {
    case "channels": listEl = channelListEl; break;
    case "fr":       listEl = channelFrListEl; break;
    case "iframes":  listEl = iframeListEl; break;
    case "favorites":listEl = favoriteListEl; break;
  }

  if (!listEl) return;

  const item = listEl.querySelector(".channel-item.active");
  if (!item) return;

  item.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

// =====================================================
// DEMO CHANNELS
// =====================================================

(function seedDemo() {
  const demo = [
    {
      name: "CMTV",
      url: "//popcdn.day/player.php?stream=CMTVPT",
      logo: { type: "image", value: "https://vsalema.github.io/StreamPilot-X-Studio-O/logos/cmtv.png" },
      group: "TV",
      isIframe: true
    },
    {
      name: "SIC Noticias",
      url: "https://cdnapisec.kaltura.com/p/4526593/sp/4526593/playManifest/entryId/1_j8ztwihx/format/applehttp/a.m3u8",
      logo: { type: "image", value: "https://vsalema.github.io/tvpt4/css/SICNoticias.png" }
    }
  ];

  demo.forEach(d => {
    channels.push({
      id: "demo-" + (channels.length+1),
      name: d.name,
      url: d.url,
      logo: d.logo,
      group: d.group,
      isIframe: d.isIframe || false,
      isFavorite: false,
      listType: "channels"
    });
  });

  renderLists();
  updateNowPlaying(null, "IDLE");
})();

// =====================================================
// OVERLAYS CUSTOM
// =====================================================

const customOverlays = [
  
  { title: "CMTV", logo: "https://vsalema.github.io/StreamPilot-X-Studio-S/logos/cmtv.png", url: "//popcdn.day/player.php?stream=CMTVPT" },

  { title: "TVI",  logo: "https://vsalema.github.io/StreamPilot-X-Studio-S/logos/TVI.png", url: "https://vsalema.github.io/tvi2/" },

  { title: "TVIR", logo: "https://vsalema.github.io/StreamPilot-X-Studio-S/logos/tvir.jpg", url: "https://vsalema.github.io/tvi-reality/" },

  { title: "TVIF", logo: "https://vsalema.github.io/StreamPilot-X-Studio-S/logos/tvif.png", url: "https://vsalema.github.io/tvi-ficcao/" },

  { title: "TVIA", logo: "https://vsalema.github.io/StreamPilot-X-Studio-S/logos/tvia.png", url: "https://vsalema.github.io/tvi-africa/" },

  { title: "SIC",  logo: "https://vsalema.github.io/StreamPilot-X-Studio-S/logos/sic.jpg", url: "https://vsalema.github.io/sic/" },

  { title: "CNN",  logo: "https://vsalema.github.io/StreamPilot-X-Studio-S/logos/cnn.png", url: "https://vsalema.github.io/CNN/" },

  { title: "RTP1", logo: "https://vsalema.github.io/StreamPilot-X-Studio-S/logos/rtp1.jpg", url: "https://vsalema.github.io/play/?https://streaming-live.rtp.pt/liverepeater/smil:rtp1HD.smil/playlist.m3u8" },

  { title: "RTPN", logo: "https://vsalema.github.io/StreamPilot-X-Studio-S/logos/rtpn.png", url: "https://vsalema.github.io/play/?https://streaming-live.rtp.pt/livetvhlsDVR/rtpnHDdvr.smil/playlist.m3u8?DVR" },

  { title: "RTPI", logo: "https://vsalema.github.io/StreamPilot-X-Studio-S/logos/rtpi.jpg", url: "https://vsalema.github.io/play/?https://streaming-live.rtp.pt/liverepeater/rtpi.smil/playlist.m3u8" },

  { title: "BTV", logo: "https://vsalema.github.io/StreamPilot-X-Studio-S/logos/btv.svg", url: "//popcdn.day/go.php?stream=BTV1" },

  { title: "SCP", logo: "https://pplware.sapo.pt/wp-content/uploads/2017/06/scp_00.jpg", url: "//popcdn.day/go.php?stream=SPT1" },

  { title: "11",  logo: "https://www.zupimages.net/up/24/13/qj99.jpg", url: "https://popcdn.day/go.php?stream=Canal11" },

  { title: "BOLA", logo: "https://www.telesatellite.com/images/actu/a/abolatv.jpg", url: "//popcdn.day/go.php?stream=ABOLA" },

  { title: "Sport tv 1", logo: "https://cdn.brandfetch.io/idKvjRibkN/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B", url: "//popcdn.day/go.php?stream=SPT1" },

  { title: "Sport tv 2", logo: "https://cdn.brandfetch.io/idKvjRibkN/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B", url: "//popcdn.day/go.php?stream=SPT2" },

  { title: "Sport tv 3", logo: "https://cdn.brandfetch.io/idKvjRibkN/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B", url: "//popcdn.day/go.php?stream=SPT3" },

  { title: "Sport tv 4", logo: "https://cdn.brandfetch.io/idKvjRibkN/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B", url: "//popcdn.day/go.php?stream=SPT4" },

  { title: "Sport tv 5", logo: "https://cdn.brandfetch.io/idKvjRibkN/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B", url: "//popcdn.day/go.php?stream=SPT5" },

  { title: "DAZN 1 PT",  logo: "https://upload.wikimedia.org/wikipedia/commons/7/71/DAZN_logo.svg", url: "//popcdn.day/go.php?stream=ELEVEN1" },

  { title: "DAZN 2 PT",  logo: "https://upload.wikimedia.org/wikipedia/commons/7/71/DAZN_logo.svg", url: "//popcdn.day/go.php?stream=ELEVEN2" },

  { title: "DAZN 3 PT",  logo: "https://upload.wikimedia.org/wikipedia/commons/7/71/DAZN_logo.svg", url: "//popcdn.day/go.php?stream=ELEVEN3" },

  { title: "DAZN 4 PT",  logo: "https://upload.wikimedia.org/wikipedia/commons/7/71/DAZN_logo.svg", url: "//popcdn.day/go.php?stream=ELEVEN4" },

 { title: "DAZN 5 PT",  logo: "https://upload.wikimedia.org/wikipedia/commons/7/71/DAZN_logo.svg", url: "//popcdn.day/go.php?stream=ELEVEN5" }
];
customOverlays.forEach((item, idx) => {
  iframeItems.push({
    id: "custom-ov-" + (idx + 1),
    name: item.title,
    url: item.url,
    logo: { type: "image", value: item.logo },
    group: "Overlay",
    isIframe: true,
    isFavorite: false
  });
});

renderIframeList();
// =====================================================
// CHARGEMENT AUTOMATIQUE DES PLAYLISTS PRINCIPALES
// =====================================================

(async function loadMainPlaylists() {
  await loadFromUrl("https://vsalema.github.io/tvpt4/css/TVradioZap-TV-Europe+_s_2024-12-27.m3u");
  await loadFrM3u("https://vsalema.github.io/tvpt4/css/playlist-tvf-r.m3u");
})();
