# TKA Learning System — GitHub Pages (fixed8)

Paket ini dibuat dengan basis:
- `Index_TKA_Tahap3_rev2.html`
- `CSS_TKA_Tahap3.html`
- `JS_TKA_Tahap3_fixed8.html`
- `Code_TKA_Tahap3.gs`
- API Gateway patch dan Worker allowlist.

## Struktur utama untuk GitHub Pages

- `index.html`
- `css/style.css`
- `js/TKA_API_Bridge.js`
- `js/app.js`

Folder `backend-reference/` hanya berisi referensi backend dan source Worker. Jangan unggah file `.gs` ke GitHub Pages sebagai frontend.

## Worker
URL Worker di Bridge: `https://tka-smpn14-api.satria-tu39.workers.dev`
Origin GitHub Pages yang harus diizinkan: `https://silviette26.github.io`

Daftar method API yang dipakai JS fixed8:
- `createExam`
- `duplicateQuestion`
- `getBootstrapData`
- `getExamAnalysis`
- `getExamDetail`
- `getExamQuestionsForBuilder`
- `getExamStudentResults`
- `getExams`
- `getQuestion`
- `getQuestionBank`
- `getStudentAttempt`
- `getStudentExams`
- `getStudentResult`
- `login`
- `saveCategory`
- `saveQuestion`
- `saveStudentAnswer`
- `setExamStatus`
- `startStudentAttempt`
- `submitStudentAttempt`
- `updateQuestion`
- `uploadQuestionImage`

## Langkah migrasi aman

1. Buat branch backup di GitHub sebelum mengganti file tahap sebelumnya.
2. Ganti file root `index.html`, `css/style.css`, dan `js/app.js` dengan versi dalam paket ini.
3. Ganti `js/TKA_API_Bridge.js` dengan versi dalam paket ini.
4. Di Cloudflare Worker, tinjau `backend-reference/cloudflare_worker_index.js` dan deploy hanya setelah memastikan tiga variable Worker benar.
5. Periksa backend Apps Script yang sedang aktif. Source referensi `Code_TKA_Tahap3_with_API_patch.gs` merupakan gabungan Code Tahap 3 dan doPost patch; jangan tempel seluruh file jika project aktif sudah memiliki perubahan lain. Bandingkan dulu, lalu tambahkan patch satu kali.
6. Apps Script Script Properties harus berisi `TKA_GATEWAY_SECRET`, sama dengan `GAS_SHARED_SECRET` di Worker.
7. Apps Script Web App harus dideploy sebagai Web App (Execute as Me, akses Anyone) untuk menerima request Worker.

## PENTING — keamanan
- Jangan pernah masukkan `GAS_SHARED_SECRET` atau `TKA_GATEWAY_SECRET` ke frontend/GitHub.
- Shared secret hanya mengamankan jalur Worker ke Apps Script; ia belum menggantikan autentikasi sesi pengguna.
- Source backend saat ini masih perlu hardening session token, validasi role, dan ownership attempt sebelum dipakai untuk ujian resmi/data siswa nyata.
- Jangan hapus deployment Apps Script lama sebelum versi baru teruji.

## Validasi setelah deploy
1. Buka halaman GitHub Pages dan cek Console/Network.
2. Uji login guru/siswa, bootstrap data, kategori, bank soal, editor MathLive, upload gambar, simpan/edit/duplikasi soal.
3. Setelah itu uji pembuatan ujian, attempt siswa, penyimpanan jawaban, submit, nilai, dan analisis.
