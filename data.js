/* ============================================================
   data.js — SUMBER DATA WIKI
   ------------------------------------------------------------
   Semua lore hidup di file ini, terpisah dari logika aplikasi
   (app.js) dan tampilan (styles.css). Untuk menambah atau
   mengubah artikel, cukup edit array SEED_ARTICLES di bawah —
   tidak perlu menyentuh app.js sama sekali.

   Struktur satu artikel:
   {
     id        : string unik (slug, tanpa spasi)
     title     : judul artikel
     universe  : "StickBot" | "StickNext"   (semesta ceritanya)
     category  : salah satu dari SEED_CATEGORIES
     tags      : array string pendek (peran, rank, jabatan, dll)
     summary   : 1 kalimat ringkas untuk pratinjau kartu
     content   : isi lengkap artikel (boleh multi-paragraf)
     images    : array data-URL gambar (kosongkan [] jika belum ada)
   }
   ============================================================ */

const SEED_UNIVERSES = ["StickBot", "StickNext"];



const SEED_CATEGORIES = [
  "Karakter",
  "Aliansi & Fraksi",
  "Antagonis",
  "Sistem & Rank",
  "Latar & Dunia",
  "Teknologi",
  "Sejarah & Lore"
];



const SEED_ARTICLES = [];

window.SEED_UNIVERSES = SEED_UNIVERSES;
window.SEED_CATEGORIES = SEED_CATEGORIES;
window.SEED_ARTICLES = SEED_ARTICLES;
window.registerArticle = article => window.SEED_ARTICLES.push(article);

const SEED_CHARACTER_SCRIPTS = [
  "sb-bluendummy.js",
  "sb-girldummy.js",
  "sb-limendummy.js",
  "sb-mandummy.js",
  "sb-reliadummy.js",
  "sb-rinadummy.js",
  "sb-robobot.js",
  "sb-zizandummy.js",
  "sn-aisyana-abilaha-mawada.js",
  "sn-ardian-vexan.js",
  "sn-astrana-moona.js",
  "sn-butterflina-flyosa.js",
  "sn-cabiraben-elivaben.js",
  "sn-eli-viana-vorneva.js",
  "sn-eliviona-melviana.js",
  "sn-falsentia-lovineta.js",
  "sn-grasshoppera-veldra.js",
  "sn-kelvinas-shorreva.js",
  "sn-lyra-elviara-yuanira.js",
  "sn-mika.js",
  "sn-mr-sam-doedan.js",
  "sn-novalios-leviosa.js",
  "sn-pakianto-elvianto.js",
  "sn-sarmanovi-velstramo.js",
  "sn-suhadiya-tri-apriyantona.js",
  "sn-voisona-lopezvilya.js",
  "sb-overview.js",
  "sb-kota-vextoria.js",
  "sb-zona-zona.js",
  "sb-rel-kereta.js",
  "sb-teknologi-hidup.js",
  "sb-tpz.js",
  "sb-asal-usul-dummy.js",
  "sb-misi-dummy.js",
  "sb-rank-protocol.js",
  "sb-devibot.js",
  "sb-delvanbot.js",
  "sn-overview.js",
  "sn-istilah-singkatan.js",
  "sn-aliansi-autobots.js",
  "sn-kufomonochi.js",
  "sn-marvozza-nightman.js",
  "sn-zen-valentiano-noviano.js",
  "sn-meliva-chelseania.js",
  "sn-jasminia-falfinera-emirana.js",
  "sn-elvontiana-eliminava-elfva.js",
  "sn-avelzion-vharmos-etrhaja.js",
  "sn-monalico-elischocho.js",
  "sn-patraboy-heavenza.js",
  "sn-ariami-milkine-meliuni.js",
  "sn-lovlania-lightlia-elia.js",
  "sn-wakasanuki-nohoiro-nukozoema.js",
  "sn-olivana-hellya-heavenly.js",
  "sn-verrazano-zhangzhou-vetrazana.js",
];

SEED_CHARACTER_SCRIPTS.forEach(src => document.write(`<script src="${src}"></script>`));


// Seleksi data siap untuk app.js
