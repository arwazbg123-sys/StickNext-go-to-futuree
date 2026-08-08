(function(){
  function escapeHtml(str){
    return String(str ?? "").replace(/[&<>\"']/g, s=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[s]));
  }

  function buildMusicIndexHeader(config = {}){
    const title = config.title || 'Indeks Musik';
    const subtitle = config.subtitle || 'Daftar musik yang terkait dengan karakter dan suasana semesta.';
    const eyebrow = config.eyebrow || 'Indeks Musik';

    return `
    <div class="creator-bio-hero">
      <div class="creator-bio-hero__eyebrow">${escapeHtml(eyebrow)}</div>
      <h1 class="article-title">${escapeHtml(title)}</h1>
      <p class="article-summary">${escapeHtml(subtitle)}</p>
    </div>`;
  }

  function renderMusicIndexPage(context = {}){
    const items = context.items || [];
    const escape = context.escapeHtml || escapeHtml;
    const header = buildMusicIndexHeader({
      title: 'Indeks Musik',
      subtitle: 'Kumpulan musik karakter yang bisa dipakai sebagai referensi suasana, mood, atau identitas tiap tokoh.',
      eyebrow: 'Template Halaman Musik'
    });

    if(items.length === 0){
      return `
      <div class="main">
        <div class="frame-wrap">
          <div class="filmstrip">
            <div style="margin-bottom:12px;"><button class="btn" id="pageBackBtn">Kembali</button></div>
            ${header}
            <div class="article-body"><p>Belum ada musik terdaftar untuk karakter manapun.</p></div>
          </div>
        </div>
      </div>`;
    }

    const listHtml = items.map(it=>`
      <div class="music-index-item" data-article="${escape(it.id)}">
        <strong>${escape(it.title)}</strong>
        <div class="music-list-preview">${escape(it.music.join(', '))}</div>
      </div>`).join('');

    return `
    <div class="main">
      <div class="frame-wrap">
        <div class="filmstrip">
          <div style="margin-bottom:12px;"><button class="btn" id="pageBackBtn">Kembali</button></div>
          ${header}
          <div class="article-body">${listHtml}</div>
        </div>
      </div>
    </div>`;
  }

  window.renderMusicIndexPage = renderMusicIndexPage;
  window.buildMusicIndexHeader = buildMusicIndexHeader;
})();
