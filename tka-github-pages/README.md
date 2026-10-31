# TKA Learning System — GitHub Pages frontend

Frontend statis hasil pemisahan empat file sumber Apps Script yang diberikan:
- `Index(1).html`
- `CSS(1).html`
- `JS(1).html`
- `Code(1).gs` (backend tetap di Google Apps Script, tidak diunggah ke Pages)

## Struktur
- `index.html` — halaman utama statis
- `css/style.css` — stylesheet
- `js/TKA_API_Bridge.js` — kompatibilitas `google.script.run` melalui Cloudflare Worker
- `js/app.js` — logika frontend dari JS sumber

## Konfigurasi
Worker URL saat ini diset di `js/TKA_API_Bridge.js`:
`https://tka-smpn14-api.satria-tu39.workers.dev`

Jangan menaruh `GAS_SHARED_SECRET` atau rahasia backend di frontend.

## Deploy
1. Ekstrak ZIP.
2. Salin isi folder `tka-github-pages` ke root repository GitHub Pages.
3. Commit dan push ke branch yang dipakai GitHub Pages.
4. Pastikan Cloudflare Worker mengizinkan origin `https://silviette26.github.io`.
5. Pastikan Worker mengizinkan method `getBootstrapData`, `login`, `saveQuestion`, dan `getQuestionBank`.
6. Buka `https://silviette26.github.io/tka-learning-system/` dan uji login, daftar mapel, simpan soal, serta filter bank soal.

## Batasan tahap ini
File sumber yang diberikan hanya mendukung login, bootstrap data, simpan soal, dan tampilkan/filter bank soal. Menu ujian dan analisis ditampilkan sebagai placeholder, bukan fitur aktif. Backend yang diberikan juga masih menyimpan password secara langsung dan belum mengeluarkan session token. Jangan gunakan akun demo atau sistem ini untuk data siswa nyata sebelum keamanan autentikasi dan otorisasi diperkuat.
