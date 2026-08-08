/*
  music.js — Seed musik untuk aplikasi
  Struktur tiap track:
  {
    id: string (unik),
    title: string,
    artist: string,
    filename: string (nama file relatif atau URL ke mp3),
    album?: string,
    tags?: [],
    duration?: string (opsional, mis. "2:34"),
    artwork?: string (nama file gambar/cover),
    notes?: string
  }

  Letakkan file mp3 di folder yang bisa diakses web (atau gunakan URL).
*/

const SEED_MUSIC = [
  {
    id: "m-pm-eliviona-panglima-kami",
    title: "Panglima Kami",
    artist: "PM Eliviona Melviana",
    filename: "PM Eliviona Melviana - Panglima Kami.mp3",
    album: "Demo",
    tags: ["theme", "panglima", "demo"],
    duration: "",
    artwork: "eliviona.jpg",
    notes: "Demo track — ganti filename atau path sesuai lokasi file mp3 Anda."
  }

  // Tambahkan track lain di bawah ini sebagai objek baru, contoh:
  // ,{
  //   id: "m-artist-track",
  //   title: "Judul Lagu",
  //   artist: "Nama Artist",
  //   filename: "path/ke/file.mp3",
  //   tags: ["mood", "tema"],
  //   artwork: "cover.jpg",
  // }
];

window.SEED_MUSIC = SEED_MUSIC;
window.registerMusic = track => window.SEED_MUSIC.push(track);
