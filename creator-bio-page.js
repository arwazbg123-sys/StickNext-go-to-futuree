(function(){
  const creatorBioPageConfig = {
    title: 'Bio Kreator',
    subtitle: 'Profil kreator, arah karya, dan fondasi yang membangun dunia semesta wiki ini.',
    eyebrow: 'Profil Kreator',
    themeLabel: 'Creator Profile',
    imageSrc: 'creator-photo.jpg',
    imageAlt: 'Foto kreator Naufal Mrsov',
    meta: [
      { label: 'Nama', value: 'Naufal Mrsov' },
      { label: 'Peran', value: 'Penulis, Direktur Kreatif, Pengembang Dunia' },
      { label: 'Fokus', value: 'Lore, karakter, estetika, dan struktur naratif' },
      { label: 'Visi', value: 'Membuat semesta yang terasa hidup, konsisten, dan emosional' },
      { label: 'Karya Utama', value: 'StickNext (Vextoria)' },
      { label: 'Pendekatan', value: 'Karakter lahir dari perasaan, bukan daftar checklist' }
    ],
    sections: [
      {
        title: 'Tentang Kreator',
        body: 'Naufal Mrsov adalah kreator di balik semesta StickNext. Ia membangun dunia Vextoria dari nol — sebuah kota cyberpunk yang dipenuhi konflik antara manusia, mafia, dummy, dan kekuatan kosmik. Karyanya dikenal karena kedalaman karakter, trauma yang manusiawi, dan pilihan yang tidak pernah hitam-putih.'
      },
      {
        title: 'Arah Karya',
        body: 'Karya ini menekankan dunia yang terasa padat, karakter berulang, dan konflik yang tidak hanya dipahami lewat aksi, tetapi juga lewat luka, dendam, dan pilihan moral. Setiap karakter punya alasan untuk menjadi seperti itu. Tidak ada yang lahir jahat — mereka hanya menjadi jahat karena sistem yang gagal.'
      },
      {
        title: 'Filosofi',
        body: 'Setiap karakter punya sebab, setiap konflik punya akar, dan setiap halaman adalah bagian dari ekosistem naratif yang terus berkembang. Naufal percaya bahwa cerita yang kuat adalah cerita yang bisa dirasakan — bukan hanya dibaca. Kebaikan yang dibuang, kepercayaan yang dikhianati, dan pilihan di tengah kegelapan adalah tema yang selalu muncul dalam karya-karyanya.'
      },
      {
        title: 'Pendekatan dalam Membangun Dunia',
        body: 'StickNext tidak dibangun dari struktur cerita yang kaku. Ia lahir dari perasaan, bukan dari daftar checklist. Zen lahir dari kebaikan yang dibuang, Lovlania lahir dari ketidakmampuan untuk mati, dan Verrazano lahir dari keyakinan bahwa tujuan membenarkan cara. Setiap karakter adalah cermin dari pertanyaan: "Apa yang terjadi saat sistem tidak peduli?"'
      }
    ]
  };

  function escapeHtml(str){
    return String(str ?? "").replace(/[&<>\"']/g, s=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[s]));
  }

  function buildCreatorHeroImage(imageSrc, imageAlt){
    if(!imageSrc) return '';
    return `
      <div class="creator-bio-hero__image">
        <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(imageAlt || 'Foto Kreator')}" />
      </div>`;
  }

  function buildCreatorBioHeader(config = {}){
    const title = config.title || creatorBioPageConfig.title;
    const subtitle = config.subtitle || creatorBioPageConfig.subtitle;
    const eyebrow = config.eyebrow || creatorBioPageConfig.eyebrow;
    const themeLabel = config.themeLabel || creatorBioPageConfig.themeLabel;
    const imageSrc = config.imageSrc || creatorBioPageConfig.imageSrc;
    const imageAlt = config.imageAlt || creatorBioPageConfig.imageAlt;
    const imageHtml = buildCreatorHeroImage(imageSrc, imageAlt);

    return `
    <div class="creator-bio-hero">
      <div class="creator-bio-hero__content">
        <div class="creator-bio-hero__eyebrow">${escapeHtml(eyebrow)}</div>
        <div class="creator-bio-hero__theme">${escapeHtml(themeLabel)}</div>
        <h1 class="article-title">${escapeHtml(title)}</h1>
        <p class="article-summary">${escapeHtml(subtitle)}</p>
      </div>
      ${imageHtml}
    </div>`;
  }

  function buildCreatorMeta(meta = []){
    if(!meta.length) return '';
    const rows = meta.map(item => `
      <div class="profile-row">
        <span class="profile-label">${escapeHtml(item.label)}</span>
        <span class="profile-value">${escapeHtml(item.value)}</span>
      </div>`).join('');
    return `<div class="profile-details">${rows}</div>`;
  }

  function buildCreatorSections(sections = []){
    if(!sections.length) return '';
    return sections.map(section => `
      <div class="creator-section">
        <h3 class="creator-section__title">${escapeHtml(section.title)}</h3>
        <p class="creator-section__body">${escapeHtml(section.body)}</p>
      </div>`).join('');
  }

  function renderCreatorBioPage(context = {}){
    const bio = context.bioData || {
      name: creatorBioPageConfig.meta.find(item => item.label === 'Nama')?.value || 'Naufal Mrsov',
      bio: creatorBioPageConfig.sections.map(section => `${section.title}: ${section.body}`).join('\n\n')
    };

    const name = bio.name || creatorBioPageConfig.meta.find(item => item.label === 'Nama')?.value || 'Kreator';
    const content = bio.bio || '';
    const header = buildCreatorBioHeader({
      title: `Bio Kreator — ${name}`,
      subtitle: creatorBioPageConfig.subtitle,
      eyebrow: creatorBioPageConfig.eyebrow,
      themeLabel: creatorBioPageConfig.themeLabel,
      imageSrc: bio.imageSrc || creatorBioPageConfig.imageSrc,
      imageAlt: bio.imageAlt || creatorBioPageConfig.imageAlt
    });

    const escape = context.escapeHtml || escapeHtml;
    const metaHtml = buildCreatorMeta(creatorBioPageConfig.meta);
    const sectionsHtml = buildCreatorSections(creatorBioPageConfig.sections);

    return `
    <div class="main">
      <div class="frame-wrap">
        <div class="filmstrip">
          <div style="margin-bottom:12px;"><button class="btn" id="pageBackBtn">Kembali</button></div>
          ${header}
          ${metaHtml}
          ${sectionsHtml}
          <div class="article-body">${escape(content)}</div>
        </div>
      </div>
    </div>`;
  }

  window.renderCreatorBioPage = renderCreatorBioPage;
  window.buildCreatorBioHeader = buildCreatorBioHeader;
})();