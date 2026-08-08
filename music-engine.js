// 1. STATE & DOM ELEMENTS
(function(){
function init() {
// Scoped music engine to avoid global name collisions
let songs = []; // Diisi otomatis dari IndexedDB saat halaman dibuka
let currentSongIndex = 0;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0; // 0: no, 1: repeat all, 2: repeat one
let searchQuery = '';
let sortMode = 'default';

const TOTAL_SLOTS = 6; // Jumlah slot demo yang ditampilkan

// UI Views
const libView = document.getElementById('library-view');
const playerView = document.getElementById('player-view');
const songListEl = document.getElementById('song-list');
const slotGridEl = document.getElementById('slot-grid');
const fileInput = document.getElementById('file-input');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');

// Basic Player DOM
const audio = document.getElementById('audio-core');
const btnPlay = document.getElementById('btn-play');
const playIcon = document.getElementById('play-icon');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const btnShuffle = document.getElementById('btn-shuffle');
const btnRepeat = document.getElementById('btn-repeat');
const seekBar = document.getElementById('seek-bar');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const playerCoverFxSelect = document.getElementById('player-cover-fx-select');

// Mini "Now Playing" bar (muncul di halaman pustaka)
let hasStartedPlayback = false;
const miniPlayerEl = document.getElementById('mini-player');
const miniCoverEl = document.getElementById('mini-cover');
const miniTitleEl = document.getElementById('mini-title');
const miniArtistEl = document.getElementById('mini-artist');
const miniPlayBtn = document.getElementById('mini-play-btn');
const miniPlayIcon = document.getElementById('mini-play-icon');

function updateMiniPlayer() {
  const s = songs[currentSongIndex];
  if (!hasStartedPlayback || !s) {
    miniPlayerEl.classList.remove('visible');
    return;
  }
  miniCoverEl.src = s.cover;
  miniTitleEl.textContent = s.title;
  miniArtistEl.textContent = s.artist;
  miniPlayIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
  if (libView.classList.contains('active')) {
    miniPlayerEl.classList.add('visible');
  } else {
    miniPlayerEl.classList.remove('visible');
  }
}

if (miniPlayerEl) {
  miniPlayerEl.addEventListener('click', (e) => {
    if (e.target.closest('#mini-play-btn')) return;
    libView.classList.remove('active');
    playerView.classList.add('active');
    updateMiniPlayer();
  });
}

if (miniPlayBtn) {
  miniPlayBtn.onclick = (e) => {
    e.stopPropagation();
    if (btnPlay) btnPlay.onclick();
    updateMiniPlayer();
  };
}

// Biar slider "Speed" benar-benar mengubah pitch (bukan cuma kecepatan)
audio.preservesPitch = false;
audio.mozPreservesPitch = false;
audio.webkitPreservesPitch = false;

// ===================================================================
// 1B. PENYIMPANAN PERMANEN (IndexedDB)
// Dipakai supaya lagu yang ditempel di Slot Demo (maupun impor biasa)
// tetap ada walau halaman di-refresh, karena blob URL biasa hilang
// setiap kali browser reload.
// ===================================================================
const DB_NAME = 'AuraSoundDB';
const DB_VERSION = 3;
const STORE_NAME = 'songs';
const PRESET_STORE = 'presets';
const PLAYLIST_STORE = 'playlists'; // Store baru khusus fitur Playlist Custom
let db = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('slotIndex', 'slotIndex', { unique: false });
      }
      if (!database.objectStoreNames.contains(PRESET_STORE)) {
        database.createObjectStore(PRESET_STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!database.objectStoreNames.contains(PLAYLIST_STORE)) {
        // Tiap playlist: { id, name, songIds: [id_lagu, ...] }
        database.createObjectStore(PLAYLIST_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function dbAddPreset(record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRESET_STORE, 'readwrite');
    const req = tx.objectStore(PRESET_STORE).add(record);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbDeletePreset(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRESET_STORE, 'readwrite');
    const req = tx.objectStore(PRESET_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbGetAllPresets() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRESET_STORE, 'readonly');
    const req = tx.objectStore(PRESET_STORE).getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// ===== CRUD Playlist (pola sama seperti CRUD Preset di atas) =====
function dbAddPlaylist(record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYLIST_STORE, 'readwrite');
    const req = tx.objectStore(PLAYLIST_STORE).add(record);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbDeletePlaylist(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYLIST_STORE, 'readwrite');
    const req = tx.objectStore(PLAYLIST_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbGetAllPlaylists() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYLIST_STORE, 'readonly');
    const req = tx.objectStore(PLAYLIST_STORE).getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// Update sebagian field playlist (nama / daftar songIds), mengikuti pola
// dbUpdateSongFields yang sudah ada di atas.
function dbUpdatePlaylist(id, fields) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYLIST_STORE, 'readwrite');
    const store = tx.objectStore(PLAYLIST_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) { reject(new Error('Playlist tidak ditemukan di penyimpanan')); return; }
      Object.assign(record, fields);
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = (e) => reject(e.target.error);
    };
    getReq.onerror = (e) => reject(e.target.error);
  });
}

function dbAddSong(record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).add(record);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbDeleteSong(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbGetAllSongs() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// Update sebagian field record (judul/artis/slotIndex) tanpa perlu punya
// ulang Blob audionya di memori — ambil record penuh dulu dari DB, timpa
// field yang berubah, lalu simpan lagi.
function dbUpdateSongFields(id, fields) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) { reject(new Error('Lagu tidak ditemukan di penyimpanan')); return; }
      Object.assign(record, fields);
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = (e) => reject(e.target.error);
    };
    getReq.onerror = (e) => reject(e.target.error);
  });
}

// Baca metadata (judul, artis, cover) dari file audio. Selalu resolve
// (tidak pernah reject) supaya alur impor tidak pernah macet.
function readAudioTags(file) {
  return new Promise((resolve) => {
    const fallback = { title: file.name, artist: 'Lokal', cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500' };
    if (!window.jsmediatags) return resolve(fallback);
    window.jsmediatags.read(file, {
      onSuccess: (tag) => {
        const result = { ...fallback };
        if (tag.tags.title) result.title = tag.tags.title;
        if (tag.tags.artist) result.artist = tag.tags.artist;
        if (tag.tags.picture) {
          const { data, format } = tag.tags.picture;
          let base64 = '';
          for (let i = 0; i < data.length; i++) base64 += String.fromCharCode(data[i]);
          result.cover = `data:${format};base64,${window.btoa(base64)}`;
        }
        resolve(result);
      },
      onError: () => resolve(fallback)
    });
  });
}

// Muat semua lagu tersimpan (slot maupun impor biasa) saat halaman dibuka
async function initLibrary() {
  try {
    db = await openDatabase();
    const records = await dbGetAllSongs();
    songs = records.map((r) => ({
      id: r.id,
      slotIndex: (r.slotIndex === undefined) ? null : r.slotIndex,
      title: r.title,
      artist: r.artist,
      cover: r.cover,
      coverEffect: r.coverEffect || 'none',
      src: URL.createObjectURL(r.audioBlob)
    }));
    // Append registry tracks from window.SEED_MUSIC (seed data, not stored in DB)
    try{
      const reg = Array.isArray(window.SEED_MUSIC) ? window.SEED_MUSIC : [];
      reg.forEach(t => {
        const id = 'seed-' + (t.id || (t.filename || Math.random().toString(36).slice(2,8)));
        const src = t.filename || t.file || '';
        songs.push({ id, slotIndex: null, title: t.title || t.filename || id, artist: t.artist || '', cover: t.artwork || '', coverEffect: t.coverEffect || 'none', src });
      });
    }catch(e){console.warn('Failed to load SEED_MUSIC registry', e);}
  } catch (err) {
    console.error('Gagal membuka penyimpanan lokal:', err);
    songs = [];
  }
  renderLibrary();
}

// 2. TONE.JS STUDIO ENGINE SETUP
let isAudioInitialized = false;
let eq3, reverb, analyser, panner, compressor, makeupGain, limiter;
const EQ_BANDS = [60, 170, 310, 600, 1000, 3000, 6000, 12000];
let graphicFilters = [];

// Promise "penjaga" supaya kalau openPlayer() terpicu dua kali dengan cepat
// (misal dobel klik), Tone.context.createMediaElementSource(audio) tidak
// pernah dipanggil dua kali pada elemen <audio> yang sama — itu akan
// membuang error dan membuat audio jadi bisu total (indikator tetap jalan,
// tapi suara mati) di percobaan berikutnya.
let toneEngineInitPromise = null;

async function initToneEngine() {
  if (isAudioInitialized) return;
  if (toneEngineInitPromise) return toneEngineInitPromise;

  toneEngineInitPromise = (async () => {
    if (typeof Tone === 'undefined') throw new Error('Tone.js tidak tersedia. Pastikan skrip Tone sudah dimuat.');

    // Node Setup
    eq3 = new Tone.EQ3({ low: 0, mid: 0, high: 0 });
    graphicFilters = EQ_BANDS.map((freq) => new Tone.Filter({ type: 'peaking', frequency: freq, Q: 1, gain: 0 }));

    // Compressor: menjaga dinamika tetap rapi saat EQ di-boost tinggi
    compressor = new Tone.Compressor({ threshold: -24, ratio: 3, attack: 0.02, release: 0.25 });

    // Gain tambahan khusus untuk fitur "Loudness Booster" (default netral/1x)
    makeupGain = new Tone.Gain(1);

    reverb = new Tone.Freeverb({ roomSize: 0.9, dampening: 3000 });
    reverb.wet.value = 0;

    // Limiter di ujung chain: pengaman terakhir supaya tidak pernah pecah/distorsi
    limiter = new Tone.Limiter(-1);

    analyser = new Tone.Analyser('fft', 256);
    panner = new Tone.Panner(0).toDestination();

    const mediaNode = Tone.context.createMediaElementSource(audio);
    Tone.connect(mediaNode, eq3);
    eq3.connect(graphicFilters[0]);
    for (let i = 0; i < graphicFilters.length - 1; i++) {
      graphicFilters[i].connect(graphicFilters[i + 1]);
    }
    graphicFilters[graphicFilters.length - 1].connect(compressor);
    compressor.connect(makeupGain);
    makeupGain.connect(reverb);
    reverb.connect(limiter);
    limiter.connect(panner);
    panner.connect(analyser);

    await Tone.start();
    await Tone.context.resume();
    isAudioInitialized = true;
    drawVisualizer();
  })();

  try {
    await toneEngineInitPromise;
  } catch (err) {
    console.error('AuraSound: gagal inisialisasi audio engine, suara mungkin tidak keluar ->', err);
    toneEngineInitPromise = null;
    throw err;
  }
}

// 3. SMART CROSSFADE ENGINE
async function smartCrossfade(nextIndex) {
  if (!isAudioInitialized) {
    currentSongIndex = nextIndex;
    loadSong();
    audio.play();
    isPlaying = true;
    if (playIcon) playIcon.className = 'fas fa-pause';
    return;
  }

  // Fade Out
  const fadeOut = new Tone.Gain(1).toDestination();
  Tone.connect(panner, fadeOut);

  fadeOut.gain.linearRampToValueAtTime(0, Tone.now() + 2);

  setTimeout(() => {
    currentSongIndex = nextIndex;
    loadSong();
    audio.play();
    // Fade In
    fadeOut.gain.linearRampToValueAtTime(1, Tone.now() + 2);
  }, 2000);
}

// ===== ANTRIAN PUTAR (dipakai saat memutar dari sebuah Playlist) =====
// playbackQueue = null artinya "jelajah semua lagu di pustaka" (perilaku lama).
// playbackQueue = [id_lagu, ...] artinya sedang memutar dari sebuah playlist,
// jadi tombol next/prev & auto-lanjut akan berputar di dalam daftar itu saja.
let playbackQueue = null;

function getQueueIndices() {
  if (playbackQueue) {
    return playbackQueue
      .map((id) => songs.findIndex((s) => s.id === id))
      .filter((idx) => idx !== -1);
  }
  return songs.map((_, i) => i); // perilaku lama: semua lagu, urut sesuai array
}

function stepQueue(currentIdx, dir) {
  const queue = getQueueIndices();
  if (queue.length === 0) return currentIdx;
  const pos = queue.indexOf(currentIdx);
  const nextPos = pos === -1 ? 0 : (pos + dir + queue.length) % queue.length;
  return queue[nextPos];
}

function renderUpNext() {
  const listEl = document.getElementById('up-next-list');
  if (!listEl) return;
  const queue = getQueueIndices();
  if (queue.length <= 1) {
    listEl.innerHTML = '<p class="up-next-empty">Tidak ada lagu lain di antrian.</p>';
    return;
  }
  const pos = queue.indexOf(currentSongIndex);
  const upcoming = [];
  for (let i = 1; i < queue.length && upcoming.length < 5; i++) {
    upcoming.push(queue[(pos + i) % queue.length]);
  }
  listEl.innerHTML = '';
  upcoming.forEach((songIdx) => {
    const s = songs[songIdx];
    if (!s) return;
    const row = document.createElement('div');
    row.className = 'up-next-row';
    row.innerHTML = `<img src="${s.cover}" loading="lazy"><div class="up-next-info"><h5>${s.title}</h5><p>${s.artist}</p></div>`;
    row.onclick = () => smartCrossfade(songIdx);
    listEl.appendChild(row);
  });
}

const waveformCache = {};
let waveformToken = 0;

function clearWaveformCanvas() {
  const canvas = document.getElementById('waveform-canvas');
  if (!canvas) return;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

async function generateWaveform(song) {
  const myToken = ++waveformToken;
  if (waveformCache[song.id]) { drawWaveform(waveformCache[song.id]); return; }
  try {
    const res = await fetch(song.src);
    const arrayBuf = await res.arrayBuffer();
    const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuf = await decodeCtx.decodeAudioData(arrayBuf);
    decodeCtx.close();
    if (myToken !== waveformToken) return;
    const peaks = extractPeaks(audioBuf, 200);
    waveformCache[song.id] = peaks;
    drawWaveform(peaks);
  } catch (err) {
    console.error('Gagal membuat waveform:', err);
  }
}

function extractPeaks(audioBuffer, numBars) {
  const channelData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / numBars);
  const peaks = new Float32Array(numBars);
  for (let i = 0; i < numBars; i++) {
    let sum = 0;
    const start = i * blockSize;
    for (let j = 0; j < blockSize; j++) sum += Math.abs(channelData[start + j] || 0);
    peaks[i] = sum / blockSize;
  }
  const max = Math.max(...peaks, 0.0001);
  for (let i = 0; i < peaks.length; i++) peaks[i] = peaks[i] / max;
  return peaks;
}

function drawWaveform(peaks) {
  const canvas = document.getElementById('waveform-canvas');
  if (!canvas) return;
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  const wctx = canvas.getContext('2d');
  wctx.clearRect(0, 0, canvas.width, canvas.height);
  const barWidth = canvas.width / peaks.length;
  wctx.fillStyle = 'rgba(192,132,252,0.7)';
  peaks.forEach((p, i) => {
    const h = Math.max(2, p * canvas.height);
    wctx.fillRect(i * barWidth, (canvas.height - h) / 2, Math.max(1, barWidth - 1), h);
  });
}

// 4. LIBRARY & IMPORT

// Render kartu Slot Demo (jumlahnya tetap TOTAL_SLOTS, kosong atau terisi)
function renderSlots() {
  slotGridEl.innerHTML = '';
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const song = songs.find((s) => s.slotIndex === i);
    const card = document.createElement('div');

    if (song) {
      card.className = 'slot-card filled';
      card.innerHTML = `
        <span class="slot-badge">Slot ${i + 1}</span>
        <img src="${song.cover}" class="slot-cover" loading="lazy">
        <div class="slot-info">
          <h4>${song.title}</h4>
          <p>${song.artist}</p>
        </div>
        <div class="slot-actions">
          <button class="slot-play-btn" title="Putar"><i class="fas fa-play"></i></button>
          <button class="slot-change-btn" title="Ganti lagu"><i class="fas fa-rotate"></i></button>
          <button class="slot-delete-btn" title="Hapus dari slot"><i class="fas fa-trash"></i></button>
        </div>
      `;
      card.querySelector('.slot-play-btn').onclick = (e) => {
        e.stopPropagation();
        openPlayer(songs.indexOf(song));
      };
      card.querySelector('.slot-change-btn').onclick = (e) => {
        e.stopPropagation();
        triggerSlotPicker(i);
      };
      card.querySelector('.slot-delete-btn').onclick = (e) => {
        e.stopPropagation();
        deleteSong(song, `Hapus lagu dari Slot ${i + 1}?`);
      };
    } else {
      card.className = 'slot-card empty';
      card.innerHTML = `
        <div class="slot-add-icon"><i class="fas fa-plus"></i></div>
        <p>Slot ${i + 1}<br><span>Tempel musik demo</span></p>
      `;
      card.onclick = () => triggerSlotPicker(i);
    }
    slotGridEl.appendChild(card);
  }
}

// Buka file picker khusus untuk 1 slot
function triggerSlotPicker(slotIndex) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) handleSlotFile(file, slotIndex);
  };
  input.click();
}

// Simpan file yang dipilih ke slot tertentu (menimpa isi slot lama jika ada)
async function handleSlotFile(file, slotIndex) {
  const tags = await readAudioTags(file);

  const existing = songs.find((s) => s.slotIndex === slotIndex);
  if (existing) {
    try { await dbDeleteSong(existing.id); } catch (e) { console.error(e); }
    songs = songs.filter((s) => s !== existing);
  }

  const record = { slotIndex, title: tags.title, artist: tags.artist, cover: tags.cover, coverEffect: 'none', audioBlob: file };
  try {
    const id = await dbAddSong(record);
    songs.push({ id, slotIndex, title: tags.title, artist: tags.artist, cover: tags.cover, coverEffect: 'none', src: URL.createObjectURL(file) });
  } catch (err) {
    console.error('Gagal menyimpan ke slot:', err);
  }
  renderLibrary();
}

// Hapus lagu dari pustaka (dipakai baik dari Slot Demo maupun daftar Pustaka Lengkap)
async function deleteSong(song, confirmMessage) {
  const msg = confirmMessage || `Hapus "${song.title}" dari pustaka? Tindakan ini tidak bisa dibatalkan.`;
  if (!window.confirm(msg)) return;
  try { await dbDeleteSong(song.id); } catch (err) { console.error('Gagal menghapus lagu:', err); }
  songs = songs.filter((s) => s !== song);
  renderLibrary();
}

// Ubah judul & artis sebuah lagu
async function renameSong(song) {
  const newTitle = window.prompt('Judul baru:', song.title);
  if (newTitle === null) return; // dibatalkan
  const newArtist = window.prompt('Artis baru:', song.artist);
  if (newArtist === null) return; // dibatalkan

  const title = newTitle.trim() || song.title;
  const artist = newArtist.trim() || song.artist;
  try {
    await dbUpdateSongFields(song.id, { title, artist });
    song.title = title;
    song.artist = artist;
    renderLibrary();
  } catch (err) {
    console.error('Gagal mengubah nama lagu:', err);
  }
}

const COVER_FX_OPTIONS = [
  { value: 'none', label: 'Efek: Tidak ada' },
  { value: 'glitch', label: '📺 Radio Rusak' },
  { value: 'vhs', label: '📼 VHS Klasik' },
  { value: 'vinyl', label: '💿 Vinyl Berputar' },
  { value: 'neon', label: '✨ Neon Berdenyut' },
  { value: 'breathing', label: '🌫️ Napas Lembut' },
  { value: 'grain', label: '🎞️ Grain Kelam' },
  { value: 'rainbow', label: '🌈 Kaleidoskop Warna' },
  { value: 'strobe', label: '⚡ Strobo' },
  { value: 'wave', label: '🌊 Ombak Gelombang' },
  { value: 'sparkle', label: '💫 Kilau' },
  { value: 'melancholy', label: '🌧️ Melankolis' },
  { value: 'heartbeat', label: '💔 Detak Jantung' },
  { value: 'fading', label: '👻 Memudar' },
  { value: 'shadow', label: '🌑 Bayangan Kelam' },
  { value: 'tears', label: '😢 Air Mata' },
  { value: 'frost', label: '❄️ Beku' },
  { value: 'ashfall', label: '🌫️ Abu Berjatuhan' },
  { value: 'candleflicker', label: '🕯️ Nyala Lilin' },
  { value: 'fog', label: '🌁 Kabut Sunyi' },
  { value: 'crackedglass', label: '🕸️ Retak' },
  { value: 'sepia', label: '📜 Nostalgia Sepia' },
  { value: 'staticnoise', label: '📡 Statis Kelam' },
  { value: 'slowzoom', label: '🎬 Zoom Sinematik' },
  { value: 'vignettepulse', label: '🖤 Vignette Berdenyut' },
  { value: 'monofade', label: '⚰️ Pudar Kelabu' },
  { value: 'bloodmoon', label: '🌘 Bulan Merah' },
  { value: 'stormflash', label: '⛈️ Kilat Badai' },
  { value: 'voidspiral', label: '🕳️ Pusaran Hampa' },
{ value: 'purplehaze', label: '💜 Kabut Ungu' },
{ value: 'embers', label: '🔥 Api Membara' },
{ value: 'clockwork', label: '🕰️ Detik Waktu' },
{ value: 'hologram', label: '👽 Hologram' },
{ value: 'prism', label: '🔺 Prisma Pecah' },
{ value: 'nightbreeze', label: '🌙 Angin Malam' },
{ value: 'timedust', label: '⏳ Debu Waktu' },
{ value: 'mirrorcrack', label: '🪞 Cermin Retak' },
{ value: 'electricwave', label: '⚡ Ombak Elektrik' },
{ value: 'ironchain', label: '⛓️ Rantai Besi' },
{ value: 'sunsetglow', label: '🌇 Senja Jingga' },
{ value: 'sandstorm', label: '🏜️ Badai Pasir' },
{ value: 'diamondshine', label: '💎 Kilau Berlian' },
{ value: 'lastbreath', label: '🖤 Nafas Terakhir' },
{ value: 'eqwave', label: '📊 Ombak Radio' },
{ value: 'timewarp', label: '🌀 Distorsi Waktu' },
{ value: 'lighttunnel', label: '🔦 Lorong Cahaya' },
{ value: 'snowfall', label: '❄️ Salju Turun' },
{ value: 'duskmoths', label: '🦋 Kupu-kupu Senja' },
{ value: 'basspulse', label: '🥁 Getar Bass' },
{ value: 'colorinject', label: '🎨 Cahaya Injeksi' },
{ value: 'starlessnight', label: '🌌 Malam Tanpa Bintang' }
];
const COVER_FX_CLASSES = [
  'fx-glitch', 'fx-vhs', 'fx-vinyl', 'fx-neon', 'fx-breathing', 'fx-grain', 'fx-rainbow', 'fx-strobe', 'fx-wave', 'fx-sparkle',
  'fx-melancholy', 'fx-heartbeat', 'fx-fading', 'fx-shadow', 'fx-tears', 'fx-frost', 'fx-ashfall', 'fx-candleflicker', 'fx-fog',
  'fx-crackedglass', 'fx-sepia', 'fx-staticnoise', 'fx-slowzoom', 'fx-vignettepulse', 'fx-monofade', 'fx-bloodmoon', 'fx-stormflash', 'fx-voidspiral',
  'fx-purplehaze', 'fx-embers', 'fx-clockwork', 'fx-hologram', 'fx-prism', 'fx-nightbreeze',
  'fx-timedust', 'fx-mirrorcrack', 'fx-electricwave', 'fx-ironchain', 'fx-sunsetglow', 'fx-sandstorm',
  'fx-diamondshine', 'fx-lastbreath', 'fx-eqwave', 'fx-timewarp', 'fx-lighttunnel', 'fx-snowfall',
  'fx-duskmoths', 'fx-basspulse', 'fx-colorinject', 'fx-starlessnight'
];

function buildCoverFxOptionsHtml(current) {
  const cur = current || 'none';
  return COVER_FX_OPTIONS.map((opt) => `<option value="${opt.value}"${opt.value === cur ? ' selected' : ''}>${opt.label}</option>`).join('');
}

// Terapkan (atau lepas) class animasi ke kotak cover di halaman player
function applyCoverEffect(song) {
  const coverEl = document.querySelector('.cover-container');
  if (!coverEl) return;
  COVER_FX_CLASSES.forEach((c) => coverEl.classList.remove(c));
  if (song && song.coverEffect && song.coverEffect !== 'none') {
    coverEl.classList.add(`fx-${song.coverEffect}`);
  }
}

// Simpan pilihan efek cover untuk sebuah lagu, dan langsung terapkan kalau lagu itu sedang dibuka
async function updateSongCoverEffect(song, effect) {
  try {
    await dbUpdateSongFields(song.id, { coverEffect: effect });
    song.coverEffect = effect;
    if (songs[currentSongIndex] === song) applyCoverEffect(song);
  } catch (err) {
    console.error('Gagal menyimpan efek cover:', err);
  }
}

if (playerCoverFxSelect) playerCoverFxSelect.addEventListener('change', (e) => {
  const song = songs[currentSongIndex];
  if (!song) return;
  updateSongCoverEffect(song, e.target.value);
});

// Pindahkan lagu ke slot tertentu, atau lepas dari slot (slotIndex = null)
async function updateSongSlot(song, slotIndex) {
  try {
    if (slotIndex !== null) {
      const occupant = songs.find((s) => s.slotIndex === slotIndex && s.id !== song.id);
      if (occupant) {
        await dbUpdateSongFields(occupant.id, { slotIndex: null });
        occupant.slotIndex = null;
      }
    }
    await dbUpdateSongFields(song.id, { slotIndex });
    song.slotIndex = slotIndex;
    renderLibrary();
  } catch (err) {
    console.error('Gagal memindahkan slot lagu:', err);
  }
}

// Urutkan daftar sesuai pilihan dropdown (tidak mengubah urutan Slot Demo)
function applySort(list) {
  const sorted = [...list];
  if (sortMode === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortMode === 'artist') sorted.sort((a, b) => a.artist.localeCompare(b.artist));
  else if (sortMode === 'newest') sorted.sort((a, b) => b.id - a.id);
  return sorted;
}

if (sortSelect) {
  sortSelect.addEventListener('change', (e) => {
    sortMode = e.target.value;
    renderLibrary();
  });
}


// Render daftar pustaka lengkap (mendukung pencarian, urutan, dan aksi per lagu)
function renderLibrary() {
  renderSlots();

  let list = songs.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
  });
  list = applySort(list);

  songListEl.innerHTML = '';
  if (list.length === 0) {
    songListEl.innerHTML = `<div class="empty-state">${searchQuery ? 'Tidak ada lagu yang cocok dengan pencarian.' : 'Pustaka kosong. Klik "Impor Musik" atau isi salah satu Slot Demo di atas.'}</div>`;
    return;
  }

  list.forEach((song) => {
    const hasSlot = song.slotIndex !== null && song.slotIndex !== undefined;
    const slotTag = hasSlot ? `<span class="demo-tag">Slot ${song.slotIndex + 1}</span>` : '';

    let slotOptions = '<option value="">Ke Slot...</option>';
    if (hasSlot) slotOptions += '<option value="none">Lepas dari Slot</option>';
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      if (song.slotIndex === i) continue;
      slotOptions += `<option value="${i}">Taruh di Slot ${i + 1}</option>`;
    }

    const div = document.createElement('div');
    div.className = 'song-card';
    div.innerHTML = `
      <img src="${song.cover}" loading="lazy">
      <div class="song-card-info"><h4>${song.title}${slotTag}</h4><p>${song.artist}</p></div>
      <div class="song-card-actions">
        <select class="cover-fx-select" title="Efek animasi cover saat diputar">${buildCoverFxOptionsHtml(song.coverEffect)}</select>
        <select class="assign-slot-select" title="Pindahkan ke slot demo">${slotOptions}</select>
        <select class="add-to-playlist-select" title="Tambahkan ke playlist">${buildAddToPlaylistOptionsHtml(song)}</select>
        <button class="song-edit-btn" title="Ubah nama"><i class="fas fa-pen"></i></button>
        <button class="song-delete-btn" title="Hapus dari pustaka"><i class="fas fa-trash"></i></button>
      </div>
    `;
    div.onclick = () => openPlayer(songs.indexOf(song));

    const actionsEl = div.querySelector('.song-card-actions');
    actionsEl.addEventListener('click', (e) => e.stopPropagation());

    div.querySelector('.cover-fx-select').addEventListener('change', (e) => {
      updateSongCoverEffect(song, e.target.value);
    });
    div.querySelector('.assign-slot-select').addEventListener('change', (e) => {
      const val = e.target.value;
      e.target.value = '';
      if (val === '') return;
      if (val === 'none') updateSongSlot(song, null);
      else updateSongSlot(song, parseInt(val, 10));
    });
    div.querySelector('.add-to-playlist-select').addEventListener('change', (e) => {
      const val = e.target.value;
      e.target.value = '';
      if (!val) return;
      addSongToPlaylist(parseInt(val, 10), song.id);
    });
    div.querySelector('.song-edit-btn').onclick = () => renameSong(song);
    div.querySelector('.song-delete-btn').onclick = () => deleteSong(song);

    songListEl.appendChild(div);
  });
}

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderLibrary();
  });
}

if (fileInput) {
  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).filter((f) => f.type.startsWith('audio/'));
    for (const file of files) {
      const tags = await readAudioTags(file);
    const record = { slotIndex: null, title: tags.title, artist: tags.artist, cover: tags.cover, coverEffect: 'none', audioBlob: file };
    try {
      const id = await dbAddSong(record);
      songs.push({ id, slotIndex: null, title: tags.title, artist: tags.artist, cover: tags.cover, coverEffect: 'none', src: URL.createObjectURL(file) });
    } catch (err) {
      console.error('Gagal menyimpan lagu:', err);
    }
  }
  renderLibrary();
  fileInput.value = '';
  });
}

// ===================================================================
// ===== FITUR BARU: PLAYLIST CUSTOM =====
// Blok ini murni tambahan: state, render, dan handler baru saja.
// Tidak ada logika lama di atas yang diubah selain 3 titik kecil yang
// sudah ditandai (DB_VERSION, openPlayer, next/prev/ended).
// ===================================================================
let playlists = [];
let currentPlaylistId = null;

const playlistGridEl = document.getElementById('playlist-grid');
const btnCreatePlaylist = document.getElementById('btn-create-playlist');
const playlistViewEl = document.getElementById('playlist-view');
const playlistDetailNameEl = document.getElementById('playlist-detail-name');
const playlistSongListEl = document.getElementById('playlist-song-list');
const btnBackPlaylist = document.getElementById('btn-back-playlist');
const btnPlaylistPlayAll = document.getElementById('btn-playlist-playall');
const btnPlaylistAddSongs = document.getElementById('btn-playlist-addsongs');
const btnPlaylistRename = document.getElementById('btn-playlist-rename');
const btnPlaylistDelete = document.getElementById('btn-playlist-delete');

// Muat semua playlist tersimpan saat halaman dibuka
async function initPlaylists() {
  try {
    playlists = await dbGetAllPlaylists();
  } catch (err) {
    console.error('Gagal memuat playlist:', err);
    playlists = [];
  }
  renderPlaylists();
}

function getCurrentPlaylist() {
  return playlists.find((p) => p.id === currentPlaylistId) || null;
}

// Opsi <select> "+ Playlist" yang muncul di tiap kartu lagu pustaka
function buildAddToPlaylistOptionsHtml(song) {
  if (playlists.length === 0) {
    return '<option value="">+ Playlist (kosong)</option>';
  }
  let html = '<option value="">+ Playlist</option>';
  playlists.forEach((p) => {
    const already = p.songIds.includes(song.id);
    html += `<option value="${p.id}"${already ? ' disabled' : ''}>${already ? '✓ ' : ''}${p.name}</option>`;
  });
  return html;
}

async function addSongToPlaylist(playlistId, songId) {
  const pl = playlists.find((p) => p.id === playlistId);
  if (!pl || pl.songIds.includes(songId)) return;
  const newIds = [...pl.songIds, songId];
  try {
    await dbUpdatePlaylist(pl.id, { songIds: newIds });
    pl.songIds = newIds;
    renderPlaylists();
  } catch (err) {
    console.error('Gagal menambah lagu ke playlist:', err);
  }
}

// Render kartu-kartu playlist di halaman pustaka
function renderPlaylists() {
  if (!playlistGridEl) return;
  playlistGridEl.innerHTML = '';
  if (playlists.length === 0) {
    playlistGridEl.innerHTML = '<div class="empty-state">Belum ada playlist. Klik "Buat Playlist" untuk mulai mengelompokkan lagu favoritmu.</div>';
    return;
  }
  playlists.forEach((pl) => {
    const plSongs = pl.songIds.map((id) => songs.find((s) => s.id === id)).filter(Boolean);
    const covers = plSongs.slice(0, 4).map((s) => s.cover);

    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.innerHTML = `
      <div class="playlist-cover-stack">
        ${covers.length ? covers.map((c) => `<img src="${c}" loading="lazy">`).join('') : '<div class="playlist-cover-empty"><i class="fas fa-music"></i></div>'}
      </div>
      <div class="playlist-card-info">
        <h4>${pl.name}</h4>
        <p>${plSongs.length} lagu</p>
      </div>
    `;
    card.onclick = () => openPlaylistDetail(pl.id);
    playlistGridEl.appendChild(card);
  });
}

if (btnCreatePlaylist) {
  btnCreatePlaylist.onclick = async () => {
    const name = window.prompt('Nama playlist baru:');
    if (!name || !name.trim()) return;
    const record = { name: name.trim(), songIds: [] };
    try {
      const id = await dbAddPlaylist(record);
      playlists.push({ id, ...record });
      renderPlaylists();
    } catch (err) {
      console.error('Gagal membuat playlist:', err);
    }
  };
}

// Buka halaman detail sebuah playlist
function openPlaylistDetail(id) {
  currentPlaylistId = id;
  libView.classList.remove('active');
  playlistViewEl.classList.add('active');
  renderPlaylistDetail();
}

if (btnBackPlaylist) {
  btnBackPlaylist.onclick = () => {
    playlistViewEl.classList.remove('active');
    libView.classList.add('active');
    currentPlaylistId = null;
  };
}

// Render daftar lagu di dalam sebuah playlist
function renderPlaylistDetail() {
  const pl = getCurrentPlaylist();
  if (!pl) return;
  playlistDetailNameEl.textContent = pl.name;
  const plSongs = pl.songIds.map((id) => songs.find((s) => s.id === id)).filter(Boolean);

  playlistSongListEl.innerHTML = '';
  if (plSongs.length === 0) {
    playlistSongListEl.innerHTML = '<div class="empty-state">Playlist ini masih kosong. Klik "Tambah Lagu" untuk mengisi.</div>';
    return;
  }
  plSongs.forEach((song) => {
    const div = document.createElement('div');
    div.className = 'song-card';
    div.innerHTML = `
      <img src="${song.cover}" loading="lazy">
      <div class="song-card-info"><h4>${song.title}</h4><p>${song.artist}</p></div>
      <div class="song-card-actions">
        <button class="song-delete-btn" title="Keluarkan dari playlist ini"><i class="fas fa-circle-minus"></i></button>
      </div>
    `;
    div.onclick = () => openPlayer(songs.indexOf(song), pl.songIds);
    div.querySelector('.song-delete-btn').onclick = async (e) => {
      e.stopPropagation();
      await removeSongFromPlaylist(pl, song.id);
    };
    playlistSongListEl.appendChild(div);
  });
}

async function removeSongFromPlaylist(pl, songId) {
  const newIds = pl.songIds.filter((id) => id !== songId);
  try {
    await dbUpdatePlaylist(pl.id, { songIds: newIds });
    pl.songIds = newIds;
    renderPlaylistDetail();
    renderPlaylists();
  } catch (err) {
    console.error('Gagal mengeluarkan lagu dari playlist:', err);
  }
}

if (btnPlaylistPlayAll) {
  btnPlaylistPlayAll.onclick = () => {
    const pl = getCurrentPlaylist();
    if (!pl || pl.songIds.length === 0) return;
    const firstSong = pl.songIds.map((id) => songs.find((s) => s.id === id)).find(Boolean);
    if (!firstSong) return;
    openPlayer(songs.indexOf(firstSong), pl.songIds);
  };
}

if (btnPlaylistRename) {
  btnPlaylistRename.onclick = async () => {
    const pl = getCurrentPlaylist();
    if (!pl) return;
    const newName = window.prompt('Nama baru untuk playlist:', pl.name);
    if (!newName || !newName.trim()) return;
    try {
      await dbUpdatePlaylist(pl.id, { name: newName.trim() });
      pl.name = newName.trim();
      playlistDetailNameEl.textContent = pl.name;
      renderPlaylists();
    } catch (err) {
      console.error('Gagal mengubah nama playlist:', err);
    }
  };
}

if (btnPlaylistDelete) {
  btnPlaylistDelete.onclick = async () => {
    const pl = getCurrentPlaylist();
    if (!pl) return;
    if (!window.confirm(`Hapus playlist "${pl.name}"? Lagu di dalamnya tidak ikut terhapus dari pustaka.`)) return;
    try {
      await dbDeletePlaylist(pl.id);
      playlists = playlists.filter((p) => p.id !== pl.id);
      btnBackPlaylist.onclick();
      renderPlaylists();
    } catch (err) {
      console.error('Gagal menghapus playlist:', err);
    }
  };
}

// Modal ringan untuk memilih lagu yang mau ditambahkan ke playlist yang sedang dibuka
function openAddSongsModal(pl) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const available = songs.filter((s) => !pl.songIds.includes(s.id));
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h4><i class="fas fa-plus"></i> Tambah Lagu ke "${pl.name}"</h4>
        <button class="modal-close-btn"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="modal-body" id="modal-song-picker"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const body = overlay.querySelector('#modal-song-picker');
  if (available.length === 0) {
    body.innerHTML = '<div class="empty-state">Semua lagu di pustaka sudah ada di playlist ini.</div>';
  }
  available.forEach((song) => {
    const row = document.createElement('div');
    row.className = 'modal-song-row';
    row.innerHTML = `
      <img src="${song.cover}" loading="lazy">
      <div class="modal-song-info"><h5>${song.title}</h5><p>${song.artist}</p></div>
      <button class="modal-add-btn" title="Tambahkan ke playlist"><i class="fas fa-plus"></i></button>
    `;
    row.querySelector('.modal-add-btn').onclick = async () => {
      const newIds = [...pl.songIds, song.id];
      try {
        await dbUpdatePlaylist(pl.id, { songIds: newIds });
        pl.songIds = newIds;
        row.remove();
        renderPlaylistDetail();
        renderPlaylists();
        if (body.children.length === 0) {
          body.innerHTML = '<div class="empty-state">Semua lagu di pustaka sudah ada di playlist ini.</div>';
        }
      } catch (err) {
        console.error('Gagal menambah lagu ke playlist:', err);
      }
    };
    body.appendChild(row);
  });

  const closeModal = () => overlay.remove();
  overlay.querySelector('.modal-close-btn').onclick = closeModal;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
}

if (btnPlaylistAddSongs) {
  btnPlaylistAddSongs.onclick = () => {
    const pl = getCurrentPlaylist();
    if (!pl) return;
    openAddSongsModal(pl);
  };
}

// 5. PLAYER LOGIC
async function openPlayer(index, queue = null) {
  playbackQueue = queue; // null = jelajah semua lagu (perilaku lama), array = mode playlist
  libView.classList.remove('active');
  playerView.classList.add('active');
  currentSongIndex = index;
  loadSong();
  if (playIcon) playIcon.className = "fas fa-play";
  updateMiniPlayer();
}

const btnBack = document.getElementById('btn-back');
if (btnBack) {
  btnBack.onclick = () => {
    playerView.classList.remove('active');
    libView.classList.add('active');
    updateMiniPlayer();
  };
}

function loadSong() {
  const s = songs[currentSongIndex];
  document.getElementById('player-title').textContent = s.title;
  document.getElementById('player-artist').textContent = s.artist;
  document.getElementById('player-cover').src = s.cover;
  audio.src = s.src;
  applyCoverEffect(s);
  playerCoverFxSelect.innerHTML = buildCoverFxOptionsHtml(s.coverEffect);
  updateMiniPlayer();

  // Reset tampilan waktu setiap ganti lagu
  seekBar.value = 0;
  timeCurrent.textContent = "0:00";
  timeTotal.textContent = "0:00";
  resetLoop();

  clearWaveformCanvas();
  generateWaveform(s);
  renderUpNext();
}

if (btnPlay) {
  btnPlay.onclick = async () => {
    if (isPlaying) {
      audio.pause(); isPlaying = false; if (playIcon) playIcon.className = "fas fa-play";
    } else {
      if (!isAudioInitialized) {
        try { await initToneEngine(); } catch (err) { console.warn('Audio engine init failed on play:', err); }
      }
      audio.play(); isPlaying = true; if (playIcon) playIcon.className = "fas fa-pause";
    }
    updateMiniPlayer();
  };
}
if (btnNext) btnNext.onclick = () => smartCrossfade(stepQueue(currentSongIndex, 1));
if (btnPrev) btnPrev.onclick = () => smartCrossfade(stepQueue(currentSongIndex, -1));

// Lagu selesai -> lanjut otomatis (menghormati repeat mode & antrian playlist)
audio.addEventListener('ended', () => {
  if (sleepTimerMode === 'end') { pauseForSleep(); return; }
  if (repeatMode === 2) {
    audio.currentTime = 0;
    audio.play();
  } else if (songs.length > 0) {
    smartCrossfade(stepQueue(currentSongIndex, 1));
  }
});

// ===== INDIKATOR WAKTU / DETIK =====
function formatTime(sec) {
  if (isNaN(sec) || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

if (audio) {
  audio.addEventListener('loadedmetadata', () => {
    if (seekBar) seekBar.max = audio.duration;
    if (timeTotal) timeTotal.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('timeupdate', () => {
    if (seekBar) seekBar.value = audio.currentTime;
    if (timeCurrent) timeCurrent.textContent = formatTime(audio.currentTime);
    if (loopA !== null && loopB !== null && audio.currentTime >= loopB) {
      audio.currentTime = loopA;
    }
  });
}

if (seekBar) {
  seekBar.addEventListener('input', () => {
    if (audio) audio.currentTime = seekBar.value;
  });
}

// 6. STUDIO FX ENGINE
const sliders = {
  speed: document.getElementById('slider-speed'),
  reverb: document.getElementById('slider-reverb'),
  bass: document.getElementById('slider-bass'),
  mid: document.getElementById('slider-mid'),
  treble: document.getElementById('slider-treble')
};

if (sliders.speed) sliders.speed.oninput = (e) => { audio.playbackRate = e.target.value; const el = document.getElementById('val-speed'); if(el) el.textContent = e.target.value + 'x'; };
if (sliders.reverb) sliders.reverb.oninput = (e) => { if(reverb) reverb.wet.value = e.target.value / 100; const el = document.getElementById('val-reverb'); if(el) el.textContent = e.target.value + '%'; };
if (sliders.bass) sliders.bass.oninput = (e) => { if(eq3) eq3.low.value = e.target.value; const el = document.getElementById('val-bass'); if(el) el.textContent = e.target.value + 'dB'; };
if (sliders.mid) sliders.mid.oninput = (e) => { if(eq3) eq3.mid.value = e.target.value; const el = document.getElementById('val-mid'); if(el) el.textContent = e.target.value + 'dB'; };
if (sliders.treble) sliders.treble.oninput = (e) => { if(eq3) eq3.high.value = e.target.value; const el = document.getElementById('val-treble'); if(el) el.textContent = e.target.value + 'dB'; };

// Helper: set nilai slider + trigger oninput-nya biar label & engine ikut update
function setSlider(key, value) {
  if (!sliders[key]) return;
  sliders[key].value = value;
  sliders[key].dispatchEvent(new Event('input'));
}

// ===== ADVANCED GRAPHIC EQ (8-BAND) =====
const graphicEqEl = document.getElementById('graphic-eq');
const graphicSliderEls = [];

if (graphicEqEl) {
  EQ_BANDS.forEach((freq, i) => {
    const col = document.createElement('div');
    col.className = 'eq-band-col';
    const label = freq >= 1000 ? (freq / 1000) + 'k' : freq;
    col.innerHTML = `
      <span class="eq-band-value" id="eq-band-val-${i}">0</span>
      <input type="range" class="eq-band-slider" id="eq-band-${i}" min="-12" max="12" step="1" value="0" orient="vertical">
      <span class="eq-band-freq">${label}</span>
    `;
    graphicEqEl.appendChild(col);

    const slider = col.querySelector(`#eq-band-${i}`);
    const valEl = col.querySelector(`#eq-band-val-${i}`);
    slider.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      valEl.textContent = (v > 0 ? '+' : '') + v;
      if (graphicFilters[i]) graphicFilters[i].gain.value = v;
    });
    graphicSliderEls.push(slider);
  });
}

function setGraphicBand(index, value) {
  const slider = graphicSliderEls[index];
  if (!slider) return;
  slider.value = value;
  slider.dispatchEvent(new Event('input'));
}

function resetGraphicBands() {
  graphicSliderEls.forEach((_, i) => setGraphicBand(i, 0));
}

const advEqToggle = document.getElementById('adv-eq-toggle');
const advEqChevron = document.getElementById('adv-eq-chevron');
if (advEqToggle) {
  advEqToggle.onclick = () => {
    if (graphicEqEl) graphicEqEl.classList.toggle('collapsed');
    if (advEqChevron) advEqChevron.classList.toggle('rotated');
  };
}

// ===== A/B LOOP =====
let loopA = null;
let loopB = null;
const btnLoopA = document.getElementById('btn-loop-a');
const btnLoopB = document.getElementById('btn-loop-b');
const btnLoopClear = document.getElementById('btn-loop-clear');
const loopStatusEl = document.getElementById('loop-status');
const loopRegionEl = document.getElementById('loop-region');

// ===== VOLUME =====
const volumeSlider = document.getElementById('volume-slider');
const volumeIcon = document.getElementById('volume-icon');

const savedVolume = parseFloat(localStorage.getItem('aurasound-volume'));
audio.volume = isNaN(savedVolume) ? 1 : savedVolume;
if (volumeSlider) {
  volumeSlider.value = audio.volume;
  updateVolumeIcon(audio.volume);

  volumeSlider.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    audio.volume = v;
    localStorage.setItem('aurasound-volume', v);
    updateVolumeIcon(v);
  });
}

let volumeBeforeMute = 1;
if (volumeIcon) {
  volumeIcon.addEventListener('click', () => {
    if (audio.volume > 0) {
      volumeBeforeMute = audio.volume;
      audio.volume = 0;
    } else {
      audio.volume = volumeBeforeMute || 1;
    }
    if (volumeSlider) volumeSlider.value = audio.volume;
    localStorage.setItem('aurasound-volume', audio.volume);
    updateVolumeIcon(audio.volume);
  });
}

function updateVolumeIcon(v) {
  if (v == 0) volumeIcon.className = 'fas fa-volume-xmark';
  else if (v < 0.5) volumeIcon.className = 'fas fa-volume-low';
  else volumeIcon.className = 'fas fa-volume-high';
}

// ===== SLEEP TIMER =====
let sleepTimerId = null;
let sleepTimerEndAt = null;
let sleepTimerMode = null; // 'minutes' | 'end' | null

const sleepTimerSelect = document.getElementById('sleep-timer-select');
const sleepTimerStatus = document.getElementById('sleep-timer-status');

function clearSleepTimer() {
  if (sleepTimerId) { clearInterval(sleepTimerId); sleepTimerId = null; }
  sleepTimerEndAt = null;
  sleepTimerMode = null;
  sleepTimerStatus.textContent = '';
}

function pauseForSleep() {
  if (audio) audio.pause();
  isPlaying = false;
  if (playIcon) playIcon.className = 'fas fa-play';
  updateMiniPlayer();
  clearSleepTimer();
  if (sleepTimerSelect) sleepTimerSelect.value = '0';
}

if (sleepTimerSelect) {
  sleepTimerSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    clearSleepTimer();
    if (val === '0') return;
    if (val === 'end') {
      sleepTimerMode = 'end';
      sleepTimerStatus.textContent = 'Berhenti setelah lagu ini';
      return;
    }
    sleepTimerMode = 'minutes';
    sleepTimerEndAt = Date.now() + parseInt(val, 10) * 60000;
    sleepTimerId = setInterval(() => {
      const remaining = sleepTimerEndAt - Date.now();
      if (remaining <= 0) { pauseForSleep(); return; }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
      sleepTimerStatus.textContent = `Berhenti dalam ${m}:${s}`;
    }, 1000);
  });
}

function updateLoopUI() {
  if (loopA !== null && loopB !== null) {
    loopStatusEl.textContent = `A-B Loop: ${formatTime(loopA)} - ${formatTime(loopB)}`;
    const dur = audio.duration || 1;
    loopRegionEl.style.left = (loopA / dur) * 100 + '%';
    loopRegionEl.style.width = Math.max(0, ((loopB - loopA) / dur) * 100) + '%';
    loopRegionEl.style.display = 'block';
  } else if (loopA !== null) {
    loopStatusEl.textContent = `Titik A ditandai (${formatTime(loopA)}), tandai titik B`;
    loopRegionEl.style.display = 'none';
  } else {
    loopStatusEl.textContent = 'A-B Loop: nonaktif';
    loopRegionEl.style.display = 'none';
  }
}

function resetLoop() {
  loopA = null;
  loopB = null;
  updateLoopUI();
}

if (btnLoopA) btnLoopA.onclick = () => {
  loopA = audio.currentTime;
  if (loopB !== null && loopB <= loopA) loopB = null;
  updateLoopUI();
};
if (btnLoopB) btnLoopB.onclick = () => {
  if (loopA === null) return;
  if (audio.currentTime <= loopA) return;
  loopB = audio.currentTime;
  updateLoopUI();
};
if (btnLoopClear) btnLoopClear.onclick = resetLoop;

// ===== PRESET CUSTOM (tersimpan permanen lewat IndexedDB) =====
let customPresets = [];
const customPresetListEl = document.getElementById('custom-preset-list');
const presetNameInput = document.getElementById('preset-name-input');
const btnSavePreset = document.getElementById('btn-save-preset');

async function initCustomPresets() {
  try {
    customPresets = await dbGetAllPresets();
  } catch (err) {
    console.error('Gagal memuat preset custom:', err);
    customPresets = [];
  }
  renderCustomPresets();
}

function renderCustomPresets() {
  customPresetListEl.innerHTML = '';
  if (customPresets.length === 0) {
    customPresetListEl.innerHTML = '<p class="preset-empty">Belum ada preset custom. Atur slider di atas lalu simpan.</p>';
    return;
  }
  customPresets.forEach((preset) => {
    const chip = document.createElement('div');
    chip.className = 'custom-preset-chip';
    chip.innerHTML = `<span>${preset.name}</span><button class="preset-delete-btn" title="Hapus"><i class="fas fa-trash"></i></button>`;
    chip.addEventListener('click', (e) => {
      if (e.target.closest('.preset-delete-btn')) return;
      applyCustomPreset(preset);
    });
    chip.querySelector('.preset-delete-btn').onclick = async (e) => {
      e.stopPropagation();
      try { await dbDeletePreset(preset.id); } catch (err) { console.error(err); }
      customPresets = customPresets.filter((p) => p.id !== preset.id);
      renderCustomPresets();
    };
    customPresetListEl.appendChild(chip);
  });
}

function applyCustomPreset(preset) {
  setSlider('speed', preset.speed);
  setSlider('bass', preset.bass);
  setSlider('mid', preset.mid);
  setSlider('treble', preset.treble);
  setSlider('reverb', preset.reverb);
  if (Array.isArray(preset.eqBands)) {
    preset.eqBands.forEach((v, i) => setGraphicBand(i, v));
  }
  document.querySelectorAll('.fx-btn').forEach((b) => b.classList.remove('active'));
}

btnSavePreset.onclick = async () => {
  const name = presetNameInput.value.trim() || `Preset ${customPresets.length + 1}`;
  const record = {
    name,
    speed: parseFloat(sliders.speed.value),
    bass: parseFloat(sliders.bass.value),
    mid: parseFloat(sliders.mid.value),
    treble: parseFloat(sliders.treble.value),
    reverb: parseFloat(sliders.reverb.value),
    eqBands: graphicSliderEls.map((s) => parseFloat(s.value))
  };
  try {
    const id = await dbAddPreset(record);
    customPresets.push({ id, ...record });
    renderCustomPresets();
    presetNameInput.value = '';
  } catch (err) {
    console.error('Gagal menyimpan preset:', err);
  }
};

// ===== PRO PRESETS =====
const presets = {
  'btn-dreamy': () => {
    setSlider('speed', 0.97);
    setSlider('bass', 2);
    setSlider('mid', 1);
    setSlider('treble', -2);
    setSlider('reverb', 55);
  },
  'btn-stadium': () => {
    setSlider('speed', 1.0);
    setSlider('bass', 2);
    setSlider('mid', 0);
    setSlider('treble', -3);
    setSlider('reverb', 75);
  },
  'btn-nightcore': () => {
    setSlider('speed', 1.3);
    setSlider('bass', 0);
    setSlider('mid', 0);
    setSlider('treble', 5);
    setSlider('reverb', 5);
  },
  'btn-slowed': () => {
    setSlider('speed', 0.8);
    setSlider('bass', 3);
    setSlider('mid', 0);
    setSlider('treble', -2);
    setSlider('reverb', 40);
  },
  'btn-karaoke': () => {
    setSlider('speed', 1.0);
    setSlider('bass', 0);
    setSlider('mid', -20);
    setSlider('treble', 0);
    setSlider('reverb', 0);
  },
  'btn-vocalboost': () => {
    setSlider('speed', 1.0);
    setSlider('bass', -2);
    setSlider('mid', 12);
    setSlider('treble', 2);
    setSlider('reverb', 0);
  },
  'btn-subbass': () => {
    setSlider('speed', 1.0);
    setSlider('bass', 20);
    setSlider('mid', -8);
    setSlider('treble', -12);
    setSlider('reverb', 0);
  },
  'btn-lofi': () => {
    setSlider('speed', 0.98);
    setSlider('bass', 6);
    setSlider('mid', -1);
    setSlider('treble', -18);
    setSlider('reverb', 10);
  },
  'btn-vaporwave': () => {
    setSlider('speed', 0.90);
    setSlider('bass', 4);
    setSlider('mid', -2);
    setSlider('treble', -4);
    setSlider('reverb', 60);
  },
  'btn-warmjazz': () => {
    setSlider('speed', 1.0);
    setSlider('bass', 3);
    setSlider('mid', 2);
    setSlider('treble', -3);
    setSlider('reverb', 20);
  },
  'btn-bassdrop': () => {
    setSlider('speed', 1.0);
    setSlider('bass', 18);
    setSlider('mid', -4);
    setSlider('treble', -6);
    setSlider('reverb', 5);
  },
  'btn-crystal': () => {
    setSlider('speed', 1.0);
    setSlider('bass', -3);
    setSlider('mid', 3);
    setSlider('treble', 10);
    setSlider('reverb', 0);
  }
};

Object.keys(presets).forEach(id => {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.onclick = () => {
    presets[id]();
    document.querySelectorAll('.fx-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
});

// ===== FITUR BARU #1: 3-BAND SPECTRUM METER =====
// Dibuat lewat JS supaya tidak perlu ubah HTML/CSS
const visCanvas = document.getElementById('visualizer-canvas');
let bandMeterWrap = null;
if (visCanvas) {
  bandMeterWrap = document.createElement('div');
  bandMeterWrap.id = 'band-meters';
  bandMeterWrap.style.cssText = 'display:flex; gap:8px; height:46px; margin-bottom:18px; align-items:stretch; background:rgba(0,0,0,0.25); border-radius:12px; padding:8px; border:1px solid rgba(255,255,255,0.05);';
  bandMeterWrap.innerHTML = `
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
    <div style="flex:1;width:100%;background:rgba(255,255,255,0.05);border-radius:6px;display:flex;align-items:flex-end;overflow:hidden;">
      <div id="meter-bass" style="width:100%;height:0%;background:#f87171;transition:height 0.06s linear;"></div>
    </div>
    <span style="font-size:9px;color:#94a3b8;letter-spacing:0.5px;">BASS</span>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
    <div style="flex:1;width:100%;background:rgba(255,255,255,0.05);border-radius:6px;display:flex;align-items:flex-end;overflow:hidden;">
      <div id="meter-mid" style="width:100%;height:0%;background:#c084fc;transition:height 0.06s linear;"></div>
    </div>
    <span style="font-size:9px;color:#94a3b8;letter-spacing:0.5px;">MID</span>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
    <div style="flex:1;width:100%;background:rgba(255,255,255,0.05);border-radius:6px;display:flex;align-items:flex-end;overflow:hidden;">
      <div id="meter-treble" style="width:100%;height:0%;background:#38bdf8;transition:height 0.06s linear;"></div>
    </div>
    <span style="font-size:9px;color:#94a3b8;letter-spacing:0.5px;">TREBLE</span>
  </div>
`;
  visCanvas.insertAdjacentElement('afterend', bandMeterWrap);

  var meterBass = document.getElementById('meter-bass');
  var meterMid = document.getElementById('meter-mid');
  var meterTreble = document.getElementById('meter-treble');
} else {
  var meterBass = null, meterMid = null, meterTreble = null;
}

function updateBandMeters(values) {
  if (!meterBass || !meterMid || !meterTreble) return;
  const len = values.length;
  const bassEnd = Math.max(1, Math.floor(len * 0.10));
  const midEnd = Math.floor(len * 0.45);

  const bandAvg = (start, end) => {
    let sum = 0;
    for (let i = start; i < end; i++) sum += values[i];
    return sum / (end - start);
  };

  const norm = (v) => Math.min(100, Math.max(0, (v + 100) * 1.4)); // dB (-100..0) -> 0..100%

  meterBass.style.height = norm(bandAvg(0, bassEnd)) + '%';
  meterMid.style.height = norm(bandAvg(bassEnd, midEnd)) + '%';
  meterTreble.style.height = norm(bandAvg(midEnd, len)) + '%';
}

// ===== FITUR BARU #2 & #5: LOUDNESS BOOSTER & MODE 8D AUDIO =====
// Tombol ditambahkan ke grid preset yang sudah ada (reuse class .fx-btn, tanpa CSS baru)
const crazyFeaturesEl = document.querySelector('.crazy-features') || document.getElementById('crazy-features');

// gedekan variabel ke scope yang lebih luas supaya handler reset bisa mengaksesnya
let btnLoudness = document.getElementById('btn-loudness') || null;
let btn8D = document.getElementById('btn-8d') || null;
let isLoudnessOn = false;
let lfo8d = null;
let is8DOn = false;

if (crazyFeaturesEl) {
  if (!btnLoudness) {
    btnLoudness = document.createElement('button');
    btnLoudness.id = 'btn-loudness';
    btnLoudness.className = 'fx-btn highlight-btn';
    btnLoudness.title = 'Boost volume aman tanpa pecah (dijaga compressor + limiter)';
    btnLoudness.textContent = '🔊 Loudness Booster';
    crazyFeaturesEl.appendChild(btnLoudness);
  }

  if (!btn8D) {
    btn8D = document.createElement('button');
    btn8D.id = 'btn-8d';
    btn8D.className = 'fx-btn highlight-btn-echo';
    btn8D.title = 'Suara bergerak mengelilingi kepala (pakai headphone!)';
    btn8D.textContent = '🎧 8D Audio';
    crazyFeaturesEl.appendChild(btn8D);
  }

  btnLoudness.onclick = () => {
    if (!isAudioInitialized) return;
    isLoudnessOn = !isLoudnessOn;
    makeupGain.gain.rampTo(isLoudnessOn ? 1.8 : 1, 0.15);
    btnLoudness.classList.toggle('active', isLoudnessOn);
  };

  btn8D.onclick = () => {
    if (!isAudioInitialized) return;
    if (!is8DOn) {
      lfo8d = new Tone.LFO({ frequency: 0.15, min: -1, max: 1, type: 'sine' }).start();
      lfo8d.connect(panner.pan);
      is8DOn = true;
    } else {
      if (lfo8d) { lfo8d.stop(); lfo8d.disconnect(); lfo8d.dispose(); lfo8d = null; }
      panner.pan.rampTo(0, 0.3);
      is8DOn = false;
    }
    btn8D.classList.toggle('active', is8DOn);
  };
}

// ===== RESET STUDIO =====
const btnResetStudio = document.getElementById('btn-reset-studio');
if (btnResetStudio) {
  btnResetStudio.onclick = () => {
    setSlider('speed', 1.0);
    setSlider('bass', 0);
    setSlider('mid', 0);
    setSlider('treble', 0);
    setSlider('reverb', 0);
    resetGraphicBands();

    if (isLoudnessOn) {
      isLoudnessOn = false;
      makeupGain.gain.rampTo(1, 0.15);
      if (btnLoudness) btnLoudness.classList.remove('active');
    }
    if (is8DOn) {
      if (lfo8d) { lfo8d.stop(); lfo8d.disconnect(); lfo8d.dispose(); lfo8d = null; }
      panner.pan.rampTo(0, 0.3);
      is8DOn = false;
      if (btn8D) btn8D.classList.remove('active');
    }
    document.querySelectorAll('.fx-btn').forEach((b) => b.classList.remove('active'));
  };
}

// Visualizer + Band Meter (satu loop biar ringan)
let canvas = null;
let ctx = null;
if (visCanvas) {
  canvas = visCanvas;
  ctx = canvas.getContext('2d');
}
function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);
  if (!isPlaying || !canvas || !ctx || !analyser) return;
  canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
  const values = analyser.getValue();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#c084fc";
  values.forEach((v, i) => {
    let h = (v + 100) * 1.5;
    ctx.fillRect(i * 3, canvas.height - h, 2, h);
  });
  updateBandMeters(values);
}

// 7. INISIALISASI: muat pustaka, slot, preset custom, dan playlist dari penyimpanan permanen
  (async () => {
    await initLibrary();
    await initCustomPresets();
    await initPlaylists();
    renderLibrary(); // refresh ulang supaya dropdown "+ Playlist" di tiap kartu lagu ikut terisi
    if (libView) libView.classList.add('active');

    // Sembunyikan overlay loading setelah semua data siap
    const loaderOverlay = document.getElementById('aura-loader-overlay');
    if (loaderOverlay) {
      loaderOverlay.classList.add('is-hidden');
      setTimeout(() => loaderOverlay.remove(), 500); // buang dari DOM setelah animasi fade selesai
    }
  })();
}

// Ensure initialization runs after DOM is ready to avoid null element lookups
if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
