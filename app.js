/* ============================================================
   app.js — LOGIKA APLIKASI WIKI VEXTORIA
   ------------------------------------------------------------
   File ini TIDAK berisi lore. Semua konten datang dari data.js
   (SEED_UNIVERSES, SEED_CATEGORIES, SEED_ARTICLES). File ini
   hanya mengurus state, render, dan interaksi pengguna.

   Catatan penyimpanan: data disimpan sepenuhnya di memori tab
   ini (sesuai permintaan) — jika halaman di-refresh, perubahan
   lewat UI (artikel baru/edit/hapus) akan kembali ke isi awal
   data.js. Untuk menambah lore secara permanen, edit langsung
   SEED_ARTICLES di data.js.
   ============================================================ */

// ---------------- STATE ----------------
let categories = [...window.SEED_CATEGORIES];
let universes = [...window.SEED_UNIVERSES];
let articles = window.SEED_ARTICLES.map(a => ({ ...a, id: a.id || cryptoId(), updatedAt: Date.now() }));

let activeUniverse = "Semua";
let activeCategory = "Semua";
let activeArticleId = articles.length ? articles[0].id : null;
let searchQuery = "";
let lightboxSrc = null;
// pageView: 'article' | 'creator' | 'musicIndex' | 'music'
let pageView = 'article';
let activeMusicFor = null;
let isSidebarOpen = false;
let isToolsOpen = false;
let themeMode = window.localStorage.getItem('wikiThemeMode') || 'dark';
let textSize = window.localStorage.getItem('wikiTextSize') || 'medium';
let readingMode = window.localStorage.getItem('wikiReadingMode') === 'true';
let hamburgerNavStyle = window.localStorage.getItem('wikiHamburgerNavStyle') || 'normal';
let hamburgerToolStyle = window.localStorage.getItem('wikiHamburgerToolStyle') || 'normal';

function cryptoId(){ return 'a' + Math.random().toString(36).slice(2,10); }

function getArticleSearchText(article){
  return [
    article.title,
    article.summary,
    article.content,
    article.bio,
    ...(article.tags || []),
    ...(article.aliases || []),
    ...(article.abilities || []),
    article.role,
    article.affiliation,
    article.origin,
    article.status,
    article.weapon
  ].join(' ').toLowerCase();
}

function isDummyCharacter(article){
  const text = getArticleSearchText(article);
  return /dummy|stickdummy|dummi/.test(text);
}

function matchesSmartSearch(article, q){
  if(!q) return true;

  const normalizedQ = q.trim().toLowerCase();
  const searchText = getArticleSearchText(article);

  const isDummyRequest = /\b(dummy|dummi|stickdummy)\b/.test(normalizedQ);
  const isHumanRequest = /\b(manusia|human|orang|non[- ]?dummy)\b/.test(normalizedQ);

  if(isDummyRequest){
    return isDummyCharacter(article);
  }

  if(isHumanRequest){
    return !isDummyCharacter(article);
  }

  return searchText.includes(normalizedQ) ||
    (article.tags || []).some(t => t.toLowerCase().includes(normalizedQ));
}

// ---------------- DERIVED DATA ----------------
function filteredArticles(){
  return articles.filter(a=>{
    const uniOk = activeUniverse === "Semua" || a.universe === activeUniverse;
    const catOk = activeCategory === "Semua" || a.category === activeCategory;
    const q = searchQuery.trim().toLowerCase();
    const searchOk = matchesSmartSearch(a, q);
    return uniOk && catOk && searchOk;
  }).sort((a,b)=> a.title.localeCompare(b.title));
}

// ---------------- RENDER ----------------
function applyTheme(){
  document.body.classList.remove('theme-light','theme-custom');
  if(themeMode === 'light') document.body.classList.add('theme-light');
  if(themeMode === 'custom') document.body.classList.add('theme-custom');
}

function applyViewSettings(){
  document.body.classList.remove('text-size-small','text-size-medium','text-size-large','reading-mode');
  document.body.classList.add(`text-size-${textSize}`);
  if(readingMode) document.body.classList.add('reading-mode');
}

function applyHamburgerVisuals(){
  const navBtn = document.getElementById('hamburgerNavBtn');
  const toolBtn = document.getElementById('hamburgerToolBtn');
  if(navBtn){
    navBtn.classList.toggle('hamburger-hidden', hamburgerNavStyle === 'hidden');
    navBtn.classList.toggle('hamburger-blur', hamburgerNavStyle === 'blur');
    navBtn.classList.toggle('hamburger-normal', hamburgerNavStyle === 'normal');
  }
  if(toolBtn){
    toolBtn.classList.toggle('hamburger-hidden', hamburgerToolStyle === 'hidden');
    toolBtn.classList.toggle('hamburger-blur', hamburgerToolStyle === 'blur');
    toolBtn.classList.toggle('hamburger-normal', hamburgerToolStyle === 'normal');
  }
}

function setTheme(mode){
  themeMode = mode;
  window.localStorage.setItem('wikiThemeMode', mode);
  applyTheme();
  render();
}

function setTextSize(size){
  textSize = size;
  window.localStorage.setItem('wikiTextSize', size);
  render();
}

function setHamburgerNavStyle(style){
  hamburgerNavStyle = style;
  window.localStorage.setItem('wikiHamburgerNavStyle', style);
  render();
}

function setHamburgerToolStyle(style){
  hamburgerToolStyle = style;
  window.localStorage.setItem('wikiHamburgerToolStyle', style);
  render();
}

function toggleReadingMode(){
  readingMode = !readingMode;
  window.localStorage.setItem('wikiReadingMode', readingMode);
  render();
}

function resetViewDefaults(){
  textSize = 'medium';
  readingMode = false;
  window.localStorage.setItem('wikiTextSize', textSize);
  window.localStorage.setItem('wikiReadingMode', 'false');
  render();
}

function renderToolDrawer(){
  return `
    <div class="tool-drawer${isToolsOpen ? ' visible' : ''}" id="toolDrawer">
      <h3>Menu Fitur</h3>
      <p>Pilih mode tampilan dan nyaman baca di semua perangkat.</p>
      <div class="tool-section">
        <div class="tool-label">Mode Tema</div>
        <div class="tool-buttons">
          <button class="tool-button${themeMode === 'dark' ? ' active' : ''}" data-theme="dark">Mode Gelap</button>
          <button class="tool-button${themeMode === 'light' ? ' active' : ''}" data-theme="light">Mode Terang</button>
          <button class="tool-button${themeMode === 'custom' ? ' active' : ''}" data-theme="custom">Mode Kostum</button>
        </div>
      </div>
      <div class="tool-section">
        <div class="tool-label">Ukuran Teks</div>
        <div class="tool-buttons">
          <button class="tool-button text-size-button${textSize === 'small' ? ' active' : ''}" data-size="small">Kecil</button>
          <button class="tool-button text-size-button${textSize === 'medium' ? ' active' : ''}" data-size="medium">Sedang</button>
          <button class="tool-button text-size-button${textSize === 'large' ? ' active' : ''}" data-size="large">Besar</button>
        </div>
      </div>
      <div class="tool-section">
        <div class="tool-label">Tampilan Hamburger</div>
        <div class="tool-subsection">
          <div class="tool-sublabel">Navigasi</div>
          <div class="tool-buttons">
            <button class="tool-button hamburger-style-button${hamburgerNavStyle === 'normal' ? ' active' : ''}" data-target="nav" data-style="normal">Normal</button>
            <button class="tool-button hamburger-style-button${hamburgerNavStyle === 'blur' ? ' active' : ''}" data-target="nav" data-style="blur">Blur</button>
            <button class="tool-button hamburger-style-button${hamburgerNavStyle === 'hidden' ? ' active' : ''}" data-target="nav" data-style="hidden">Sembunyi</button>
          </div>
        </div>
        <div class="tool-subsection">
          <div class="tool-sublabel">Tema</div>
          <div class="tool-buttons">
            <button class="tool-button hamburger-style-button${hamburgerToolStyle === 'normal' ? ' active' : ''}" data-target="tool" data-style="normal">Normal</button>
            <button class="tool-button hamburger-style-button${hamburgerToolStyle === 'blur' ? ' active' : ''}" data-target="tool" data-style="blur">Blur</button>
            <button class="tool-button hamburger-style-button${hamburgerToolStyle === 'hidden' ? ' active' : ''}" data-target="tool" data-style="hidden">Sembunyi</button>
          </div>
        </div>
      </div>
      <div class="tool-section">
        <div class="tool-label">Mode Baca</div>
        <button class="tool-button${readingMode ? ' active' : ''}" id="toggleReadingModeBtn">${readingMode ? 'Matikan Mode Baca' : 'Aktifkan Mode Baca'}</button>
      </div>
      <div class="tool-section">
        <button class="tool-button" id="resetViewBtn">Kembalikan Default Tampilan</button>
      </div>
    </div>
    <div class="tool-drawer-overlay${isToolsOpen ? ' visible' : ''}" id="toolDrawerOverlay"></div>
  `;
}

function render(){
  applyTheme();
  applyViewSettings();
  // preserve sidebar scroll position so clicked card doesn't "jump" after re-render
  const prevCatScroll = (function(){
    try{ const el = document.querySelector('.cat-scroll'); return el ? el.scrollTop : 0; }catch(e){ return 0; }
  })();

  const app = document.getElementById('app');
  app.innerHTML = `
    <button class="hamburger-btn nav-hamburger" id="hamburgerNavBtn" aria-label="Buka navigasi"><span></span></button>
    <button class="hamburger-btn tool-hamburger" id="hamburgerToolBtn" aria-label="Buka fitur"><span></span></button>
    ${renderToolDrawer()}
    <div class="mobile-sidebar-overlay" id="mobileSidebarOverlay"></div>
    ${renderSidebar()}
    ${renderMain()}
    ${lightboxSrc ? renderLightbox() : ""}
  `;

  applyHamburgerVisuals();

  // restore previous sidebar scroll (if present)
  try{
    const newEl = document.querySelector('.cat-scroll');
    if(newEl) newEl.scrollTop = prevCatScroll;
  }catch(e){}

  attachEvents();
}

function renderSidebar(){
  const list = filteredArticles();
  const grouped = {};
  list.forEach(a=>{
    grouped[a.category] = grouped[a.category] || [];
    grouped[a.category].push(a);
  });

  const universeTabs = ["Semua", ...universes].map(u=>{
    const isActive = activeUniverse === u;
    return `<button class="universe-tab ${isActive?'active':''}" data-universe="${escapeAttr(u)}">${escapeHtml(u)}</button>`;
  }).join("");

  const visibleCats = activeUniverse === "Semua"
    ? categories
    : categories.filter(c => articles.some(a => a.universe === activeUniverse && a.category === c));

  const catButtons = ["Semua", ...visibleCats].map(cat=>{
    const count = cat === "Semua"
      ? (activeUniverse === "Semua" ? articles.length : articles.filter(a=>a.universe===activeUniverse).length)
      : articles.filter(a => a.category===cat && (activeUniverse === "Semua" || a.universe === activeUniverse)).length;
    const isActive = activeCategory === cat;
    return `<button class="folder-tab ${isActive?'active':''}" data-cat="${escapeAttr(cat)}">
      <span>${escapeHtml(cat)}</span><span class="folder-count">${count}</span>
    </button>`;
  }).join("");

  let articleListHtml = "";
  const catsToShow = activeCategory === "Semua" ? visibleCats : [activeCategory];
  catsToShow.forEach(cat=>{
    const items = grouped[cat] || [];
    if(items.length === 0) return;
    articleListHtml += items.map(a=>`
      <button class="article-item ${a.id===activeArticleId?'active':''}" data-article="${a.id}">${escapeHtml(a.title)}</button>
    `).join("");
  });

  return `
  <div class="sidebar${isSidebarOpen ? ' open' : ''}">
    <div class="brand">
      <div class="brand-eyebrow">Production Bible</div>
      <div class="brand-title">Wiki StickBotnext</div>
    </div>
    <div class="universe-tabs">${universeTabs}</div>
    <div class="search-wrap">
      <input class="search-input" id="searchInput" type="text" placeholder="Cari artikel, tag, dummy, manusia..." value="${escapeAttr(searchQuery)}">
    </div>
    <div class="cat-scroll">
      <div class="cat-header"><span class="cat-label">Kategori</span></div>
      ${catButtons}
      <div class="cat-header" style="margin-top:14px;"><span class="cat-label">Artikel</span></div>
      ${articleListHtml || '<div style="padding:10px;color:var(--text-muted);font-size:12.5px;">Tidak ada artikel.</div>'}
    </div>
    <div class="sidebar-actions">
      <button class="btn" id="creatorBioBtn">Bio Kreator</button>
      <button class="btn" id="musicIndexBtn">Indeks Musik</button>
      <div style="flex:1"></div>
      <div class="sidebar-note">Semua lore dan karakter adalah ciptaan Naufal Mrsov.</div>
    </div>
  </div>`;
}

function renderMain(){
  // route to special pages when requested
  if(pageView === 'creator') return renderCreatorBio();
  if(pageView === 'musicIndex') return renderMusicIndex();
  if(pageView === 'music') return renderMusicForCharacter(activeMusicFor);

  const article = articles.find(a=>a.id === activeArticleId);
  if(!article){
    return `
    <div class="main">
      <div class="empty-state">
        <div class="reel">◎ ◎ ◎</div>
        <h2>Belum ada artikel terpilih</h2>
        <p>Pilih artikel dari daftar di kiri untuk melihat detail karakter.</p>
      </div>
    </div>`;
  }

  const dt = new Date(article.updatedAt);
  const dateStr = dt.toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'}) + ' · ' + dt.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  const tagsHtml = (article.tags||[]).map(t=>`<span class="tag-chip">${escapeHtml(t)}</span>`).join("");
  const detailsHtml = renderProfileDetails(article);
  const headerHtml = renderVisualHeader(article);
  const images = normalizeImages(article);

  return `
  <div class="main">
    <div class="frame-wrap">
      <div class="filmstrip">
        ${headerHtml}
        <div class="article-topline">
          <span class="badge badge-universe">${escapeHtml(article.universe)}</span>
          <span class="badge">${escapeHtml(article.category)}</span>
          ${tagsHtml}
          <span class="meta-ts">Diperbarui ${dateStr}</span>
        </div>
        <h1 class="article-title">${escapeHtml(article.title)}</h1>
        ${article.summary ? `<div class="article-summary">${escapeHtml(article.summary)}</div>` : ""}
        ${detailsHtml}
        <div class="article-actions" style="margin:12px 0;">
          <button class="btn" id="musicBtn">Musik</button>
        </div>
        <div class="article-body">${escapeHtml(article.content) || '<span style="color:var(--text-muted)">Belum ada isi.</span>'}</div>
        ${images.length > 1 ? `<div class="gallery">${images.map(img=>`<img src="${img}" data-lightbox="${escapeAttr(img)}">`).join("")}</div>` : ""}
      </div>
    </div>
  </div>`;
}

function normalizeImages(article){
  if(!article.images) return [];
  if(typeof article.images === 'string'){
    const value = article.images.trim();
    if(!value || value === 'Contoh Foto') return [];
    return [value];
  }
  if(Array.isArray(article.images)){
    return article.images.filter(img=>typeof img === 'string' && img.trim());
  }
  return [];
}

function normalizeMusic(article){
  if(!article || !article.music) return [];
  if(typeof article.music === 'string'){
    const v = article.music.trim();
    if(!v || v === 'Contoh Musik') return [];
    return v.split(',').map(s=>s.trim()).filter(Boolean);
  }
  if(Array.isArray(article.music)){
    return article.music.map(String).filter(Boolean);
  }
  return [];
}

function getRegistryMusic(){
  try{ return Array.isArray(window.SEED_MUSIC) ? window.SEED_MUSIC : []; }catch(e){ return []; }
}

function getRegistryTracksForArticle(articleId){
  const reg = getRegistryMusic();
  return reg.filter(t => t.associatedArticleId === articleId);
}

function renderCreatorBio(){
  if(typeof window.renderCreatorBioPage === 'function'){
    return window.renderCreatorBioPage({
      bioData: window.SEED_CREATOR_BIO || { name: 'Naufal Mrsov', bio: 'Bio kreator belum ditambahkan. Edit data pusat untuk menambah SEED_CREATOR_BIO.' },
      escapeHtml
    });
  }

  const bio = window.SEED_CREATOR_BIO || { name: 'Naufal Mrsov', bio: 'Bio kreator belum ditambahkan. Edit `data.js` untuk menambah SEED_CREATOR_BIO.' };
  const name = escapeHtml(bio.name || 'Kreator');
  const content = escapeHtml(bio.bio || '');
  return `
  <div class="main">
    <div class="frame-wrap">
      <div class="filmstrip">
        <div style="margin-bottom:12px;"><button class="btn" id="pageBackBtn">Kembali</button></div>
        <h1 class="article-title">Bio Kreator — ${name}</h1>
        <div class="article-body">${content}</div>
      </div>
    </div>
  </div>`;
}

function renderMusicIndex(){
  // Build music index by combining article-level `music` fields and global SEED_MUSIC registry
  const registry = getRegistryMusic();
  const items = articles.map(a=>{
    const articleList = normalizeMusic(a); // strings from article.music
    // registry tracks explicitly linked to this article
    const regTracks = getRegistryTracksForArticle(a.id).map(t => t.title || t.filename || t.id);
    // also try to match registry entries by filename or id referenced in articleList
    const matchedFromArticle = articleList.map(ref => {
      const byId = registry.find(r => r.id === ref || r.filename === ref || (r.filename && r.filename.includes(ref)));
      return byId ? (byId.title || byId.filename || byId.id) : ref;
    });
    const combined = Array.from(new Set([...regTracks, ...matchedFromArticle]));
    return { id:a.id, title:a.title, music: combined };
  }).filter(x=> x.music.length);

  if(typeof window.renderMusicIndexPage === 'function'){
    return window.renderMusicIndexPage({ items, escapeHtml });
  }

  if(items.length === 0){
    return `
    <div class="main">
      <div class="frame-wrap">
        <div class="filmstrip">
          <div style="margin-bottom:12px;"><button class="btn" id="pageBackBtn">Kembali</button></div>
          <h2>Indeks Musik</h2>
          <p>Tidak ada musik terdaftar untuk karakter manapun.</p>
        </div>
      </div>
    </div>`;
  }
  const listHtml = items.map(it=>`<div class="music-index-item" data-article="${escapeAttr(it.id)}"><strong>${escapeHtml(it.title)}</strong><div class="music-list-preview">${escapeHtml(it.music.join(', '))}</div></div>`).join('');
  return `
  <div class="main">
    <div class="frame-wrap">
      <div class="filmstrip">
        <div style="margin-bottom:12px;"><button class="btn" id="pageBackBtn">Kembali</button></div>
        <h1 class="article-title">Indeks Musik</h1>
        <div class="article-body">${listHtml}</div>
      </div>
    </div>
  </div>`;
}

function renderMusicForCharacter(id){
  const a = articles.find(x=>x.id===id);
  if(!a) return renderMusicIndex();
  const tracks = normalizeMusic(a);
  const tracksHtml = tracks.length ? `<ol>${tracks.map(t=>`<li>${escapeHtml(t)}</li>`).join('')}</ol>` : '<p>Tidak ada musik terdaftar untuk karakter ini.</p>';
  return `
  <div class="main">
    <div class="frame-wrap">
      <div class="filmstrip">
        <div style="margin-bottom:12px;"><button class="btn" id="pageBackBtn">Kembali</button></div>
        <h1 class="article-title">Musik — ${escapeHtml(a.title)}</h1>
        <div class="article-body">${tracksHtml}</div>
      </div>
    </div>
  </div>`;
}

function renderVisualHeader(article){
  const images = normalizeImages(article);
  if(images.length === 0){
    return "";
  }
  const mainImg = images[0];
  const secondary = images.slice(1, 4);
  const thumbsHtml = secondary.length ? `<div class="article-hero-thumbs">${secondary.map(img=>`<div class="article-hero-thumb"><img src="${img}" data-lightbox="${escapeAttr(img)}"></div>`).join("")}</div>` : "";
  return `
  <div class="article-hero">
    <img src="${mainImg}" data-lightbox="${escapeAttr(mainImg)}">
    <div class="article-hero-overlay">
      <div class="article-hero-label">Foto Visual</div>
      <div class="article-hero-title">${escapeHtml(article.title)}</div>
      ${article.summary ? `<div class="article-hero-subtitle">${escapeHtml(article.summary)}</div>` : ""}
      ${thumbsHtml}
    </div>
  </div>`;
}

function renderProfileDetails(article){
  const rows = [];
  if((article.aliases || []).length){
    rows.push({ label: 'Aliases', value: article.aliases.join(', ') });
  }
  if(article.role) rows.push({ label: 'Role', value: article.role });
  if(article.affiliation) rows.push({ label: 'Affiliation', value: article.affiliation });
  if(article.origin) rows.push({ label: 'Origin', value: article.origin });
  if(article.status) rows.push({ label: 'Status', value: article.status });
  if(article.height) rows.push({ label: 'Height', value: article.height });
  if(article.age) rows.push({ label: 'Age', value: article.age });
  if(article.weapon) rows.push({ label: 'Weapon', value: article.weapon });
  if(rows.length === 0 && !(article.abilities || []).length && !article.bio) return '';

  const rowsHtml = rows.map(item => `
      <div class="profile-row">
        <span class="profile-label">${escapeHtml(item.label)}</span>
        <span class="profile-value">${escapeHtml(item.value)}</span>
      </div>`).join('');

  const abilitiesHtml = (article.abilities || []).map(ability => `<span class="tag-chip">${escapeHtml(ability)}</span>`).join('');
  const bioHtml = article.bio ? `<div class="article-bio">${escapeHtml(article.bio).replace(/\n/g,'<br>')}</div>` : '';

  return `
  <div class="profile-details">
    ${rowsHtml}
    ${abilitiesHtml ? `<div class="profile-heading">Abilities</div><div class="profile-tags">${abilitiesHtml}</div>` : ''}
    ${bioHtml}
  </div>`;
}

function renderLightbox(){
  return `<div class="lightbox" id="lightbox"><img src="${lightboxSrc}"></div>`;
}

// ---------------- EVENTS ----------------
function attachEvents(){
  const searchInput = document.getElementById('searchInput');
  if(searchInput){
    searchInput.addEventListener('input', e=>{
      searchQuery = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const el = document.getElementById('searchInput');
      if(el){ el.focus(); el.setSelectionRange(pos,pos); }
    });
  }

  document.querySelectorAll('.universe-tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      activeUniverse = btn.dataset.universe;
      activeCategory = "Semua";
      render();
    });
  });

  document.querySelectorAll('.folder-tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      activeCategory = btn.dataset.cat;
      render();
    });
  });

  document.querySelectorAll('.article-item').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      activeArticleId = btn.dataset.article;
      render();
    });
  });

  document.querySelectorAll('[data-lightbox]').forEach(img=>{
    img.addEventListener('click', ()=>{ lightboxSrc = img.dataset.lightbox; render(); });
  });

  const lb = document.getElementById('lightbox');
  if(lb) lb.addEventListener('click', ()=>{ lightboxSrc = null; render(); });

  // creator / music buttons
  const creatorBtn = document.getElementById('creatorBioBtn');
  if(creatorBtn) creatorBtn.addEventListener('click', ()=>{ pageView = 'creator'; render(); });
  const musicIndexBtn = document.getElementById('musicIndexBtn');
  if(musicIndexBtn) musicIndexBtn.addEventListener('click', ()=>{ pageView = 'musicIndex'; render(); });
  const musicBtn = document.getElementById('musicBtn');
  if(musicBtn) musicBtn.addEventListener('click', ()=>{ pageView = 'music'; activeMusicFor = activeArticleId; render(); });

  document.querySelectorAll('.music-index-item').forEach(el=>{
    el.addEventListener('click', ()=>{ activeMusicFor = el.dataset.article; pageView = 'music'; render(); });
  });

  const pageBack = document.getElementById('pageBackBtn');
  if(pageBack) pageBack.addEventListener('click', ()=>{ pageView = 'article'; activeMusicFor = null; isSidebarOpen = false; render(); });

  const hamburgerNavBtn = document.getElementById('hamburgerNavBtn');
  const hamburgerToolBtn = document.getElementById('hamburgerToolBtn');
  const sidebar = document.querySelector('.sidebar');
  const sidebarOverlay = document.getElementById('mobileSidebarOverlay');
  const toolDrawer = document.getElementById('toolDrawer');
  const toolDrawerOverlay = document.getElementById('toolDrawerOverlay');
  if(hamburgerNavBtn){
    hamburgerNavBtn.addEventListener('click', ()=>{
      isSidebarOpen = !isSidebarOpen;
      if(isSidebarOpen){
        isToolsOpen = false;
      }
      if(sidebar) sidebar.classList.toggle('open', isSidebarOpen);
      if(sidebarOverlay) sidebarOverlay.classList.toggle('visible', isSidebarOpen);
      if(toolDrawer) toolDrawer.classList.toggle('visible', isToolsOpen);
      if(toolDrawerOverlay) toolDrawerOverlay.classList.toggle('visible', isToolsOpen);
    });
  }
  if(hamburgerToolBtn){
    hamburgerToolBtn.addEventListener('click', ()=>{
      isToolsOpen = !isToolsOpen;
      if(isToolsOpen){
        isSidebarOpen = false;
      }
      if(toolDrawer) toolDrawer.classList.toggle('visible', isToolsOpen);
      if(toolDrawerOverlay) toolDrawerOverlay.classList.toggle('visible', isToolsOpen);
      if(sidebar) sidebar.classList.toggle('open', isSidebarOpen);
      if(sidebarOverlay) sidebarOverlay.classList.toggle('visible', isSidebarOpen);
    });
  }
  if(toolDrawerOverlay){
    toolDrawerOverlay.addEventListener('click', ()=>{
      isToolsOpen = false;
      if(toolDrawer) toolDrawer.classList.remove('visible');
      toolDrawerOverlay.classList.remove('visible');
    });
  }
  if(sidebarOverlay){
    sidebarOverlay.addEventListener('click', ()=>{
      isSidebarOpen = false;
      if(sidebar) sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('visible');
    });
  }
  document.querySelectorAll('.tool-button[data-theme]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const mode = btn.dataset.theme;
      if(mode) setTheme(mode);
      isToolsOpen = false;
      if(toolDrawer) toolDrawer.classList.remove('visible');
      if(toolDrawerOverlay) toolDrawerOverlay.classList.remove('visible');
    });
  });

  document.querySelectorAll('.text-size-button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const size = btn.dataset.size;
      if(size) setTextSize(size);
      isToolsOpen = false;
      if(toolDrawer) toolDrawer.classList.remove('visible');
      if(toolDrawerOverlay) toolDrawerOverlay.classList.remove('visible');
    });
  });

  const readingModeBtn = document.getElementById('toggleReadingModeBtn');
  if(readingModeBtn){
    readingModeBtn.addEventListener('click', ()=>{
      toggleReadingMode();
      isToolsOpen = false;
      if(toolDrawer) toolDrawer.classList.remove('visible');
      if(toolDrawerOverlay) toolDrawerOverlay.classList.remove('visible');
    });
  }

  const resetViewBtn = document.getElementById('resetViewBtn');
  if(resetViewBtn){
    resetViewBtn.addEventListener('click', ()=>{
      resetViewDefaults();
      isToolsOpen = false;
      if(toolDrawer) toolDrawer.classList.remove('visible');
      if(toolDrawerOverlay) toolDrawerOverlay.classList.remove('visible');
    });
  }

  document.querySelectorAll('.hamburger-style-button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const target = btn.dataset.target;
      const style = btn.dataset.style;
      if(target === 'nav') setHamburgerNavStyle(style);
      if(target === 'tool') setHamburgerToolStyle(style);
      isToolsOpen = false;
      if(toolDrawer) toolDrawer.classList.remove('visible');
      if(toolDrawerOverlay) toolDrawerOverlay.classList.remove('visible');
    });
  });

  document.querySelectorAll('.universe-tab, .folder-tab, .article-item').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      isSidebarOpen = false;
      if(sidebar) sidebar.classList.remove('open');
      if(sidebarOverlay) sidebarOverlay.classList.remove('visible');
    });
  });

  // Show/hide the full music engine UI which lives outside #app
  try{
    const musicRoot = document.getElementById('aura-music-root');
    if(musicRoot) musicRoot.style.display = (pageView === 'musicIndex' || pageView === 'music') ? 'block' : 'none';
  }catch(e){}
}

// ---------------- UTIL ----------------
function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, s=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}
function escapeAttr(str){ return escapeHtml(str); }

render();
