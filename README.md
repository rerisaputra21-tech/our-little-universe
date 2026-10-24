# Our Little Universe — Starter Website

Website album kenangan keluarga dengan desain responsif, login Firebase, dan akses berdasarkan dokumen anggota aktif.

## Fitur starter
- Login email dan kata sandi Firebase Authentication.
- Hanya akun yang dibuat admin dan memiliki dokumen `members/{uid}` aktif yang dapat masuk.
- Album metadata di Cloud Firestore.
- Foto di Firebase Storage dan dibaca melalui `getBlob()` agar aplikasi tidak menyimpan URL download token publik.
- Admin dapat mengunggah dan menghapus foto.
- Pencarian judul/catatan dan filter tahun.
- HTML/CSS/JavaScript sederhana; bisa diedit dari browser HP.

## Penting soal privasi dan biaya
- GitHub Pages pada paket gratis menggunakan repo publik. Semua kode website publik; jangan pernah masukkan foto keluarga, kata sandi, token, atau rahasia di repo. Foto tidak disimpan di repo.
- Cloud Storage for Firebase mewajibkan paket Blaze (billing tertaut) untuk bucket baru/akses bucket. Kuota tertentu bisa tanpa biaya, tetapi penggunaan di atas kuota dapat menimbulkan tagihan. Jika ingin benar-benar tanpa metode pembayaran, jangan aktifkan Storage; gunakan prototipe metadata saja atau pilih penyedia penyimpanan privat lain setelah mengecek ketentuan terbaru.
- Jangan menaruh service-account key di browser.
- Kode ini adalah starter yang harus diuji sebelum digunakan untuk foto pribadi. Aturan keamanan server adalah sumber izin utama; menyembunyikan tombol bukanlah keamanan.
- File app.js memakai `getBlob()` untuk menghindari tautan download token yang dapat diteruskan. Akses browser ke bucket mungkin memerlukan konfigurasi CORS untuk domain website. Konfigurasi CORS bucket umumnya perlu Google Cloud CLI/Cloud Shell; jika foto gagal tampil, jangan mengganti ke URL token publik sebagai jalan pintas.
- Tidak ada pembuatan akun publik di website. Admin membuat akun anggota lewat Firebase Console, lalu menambahkan dokumen anggota. Ini menghindari pendaftaran bebas.

## Struktur file
- `index.html` — struktur halaman
- `style.css` — desain responsif
- `app.js` — login, album, unggah, cari, hapus
- `firestore.rules` — aturan akses database
- `storage.rules` — aturan akses file

## Langkah setup lewat HP Android

### A. Buat repository GitHub
1. Buka https://github.com dan masuk.
2. Buat repository baru bernama `our-little-universe`.
3. Untuk GitHub Free + Pages, repository perlu Public. Ini membuat source code terlihat publik, jadi jangan simpan foto atau data pribadi di sini.
4. Unggah file `index.html`, `style.css`, `app.js`, `firestore.rules`, `storage.rules`, dan `README.md` dari ZIP ini. Gunakan Add file > Upload files di browser.
5. Masuk Settings > Pages. Pilih deploy dari branch `main`, folder `/(root)`, lalu Save.
6. Setelah proses selesai, URL biasanya `https://USERNAME.github.io/our-little-universe/`.

### B. Buat Firebase project
1. Buka https://console.firebase.google.com dan buat project.
2. Tambahkan Web App (ikon `</>`). Salin konfigurasi SDK.
3. Ganti seluruh nilai `ISI_...` di `app.js` dengan konfigurasi proyek. Konfigurasi web Firebase bukan kata sandi admin; tetap gunakan Rules yang ketat.
4. Authentication > Sign-in method > aktifkan Email/Password.
5. Authentication > Settings: aktifkan perlindungan enumerasi email jika tersedia. Tambahkan domain GitHub Pages ke Authorized domains (contoh `USERNAME.github.io`; gunakan hostname saja).
6. Buat Cloud Firestore database.
7. Firestore > Rules: tempel isi `firestore.rules`, lalu Publish.
8. Untuk unggah foto, siapkan Storage bucket dan cek persyaratan billing saat ini. Tempel `storage.rules` pada tab Rules dan Publish. Jangan memilih aturan publik.

### C. Buat akun admin pertama
1. Authentication > Users > Add user. Masukkan email milikmu dan kata sandi kuat.
2. Salin UID pengguna tersebut.
3. Firestore > Data > Start collection: `members`.
4. Buat document ID persis UID tersebut. Tambahkan fields:
   - `displayName` (string): nama panggilan admin
   - `role` (string): `admin`
   - `active` (boolean): `true`
5. Simpan. Tanpa dokumen ini, login akan ditolak.

### D. Undang anggota keluarga
Untuk setiap anggota:
1. Admin membuat akun dari Firebase Authentication > Users > Add user dengan email anggota dan kata sandi sementara. Sampaikan kata sandi sementara secara pribadi, bukan di grup umum; minta anggota menggantinya jika alur reset password sudah ditambahkan.
2. Salin UID akun tersebut.
3. Buat dokumen `members/{UID}` di Firestore dengan `displayName` (string), `role` (string) `member`, dan `active` (boolean) `true`.
4. Anggota bisa login. Akun tanpa dokumen aktif tidak bisa membaca album.
5. Untuk mencabut akses, ubah `active` menjadi `false` di dokumen anggota. Rules akan menolak permintaan database/storage berikutnya; untuk sesi yang sedang aktif, lakukan sign out dan tes ulang.

## Uji keamanan sebelum dipakai
1. Login tanpa akun: harus gagal membaca album.
2. Login akun yang tidak memiliki dokumen members: harus ditolak.
3. Anggota aktif: bisa membaca album tetapi tidak bisa membuat/menghapus metadata.
4. Admin aktif: bisa mengunggah/menghapus foto.
5. Nonanggota tidak boleh membaca file Storage meskipun mengetahui path.
6. Ubah `active` anggota menjadi `false`, lalu tes akses kembali.
7. Coba file lebih dari 5 MB dan file bukan gambar: harus ditolak.
8. Pastikan tidak ada foto, email keluarga, atau data pribadi di repo GitHub.
9. Jangan lanjut memakai foto sensitif jika aturan belum diuji. Untuk uji formal, gunakan Firebase Rules Playground/Emulator; jangan hanya mengandalkan tampilan UI.

## Batas starter
- Hanya admin yang dapat mengunggah/menghapus foto.
- Belum ada undangan otomatis melalui email, reset kata sandi dari halaman, album bersama per acara, atau pengaturan admin dari UI.
- Penambahan akun dilakukan melalui Firebase Console agar tidak perlu backend server.
- File `storage.rules` memeriksa dokumen anggota di Firestore; Firebase dapat meminta izin akses Rules ke Firestore. Ikuti prompt izin yang ditampilkan di Firebase Console.
- `getBlob()` mungkin memerlukan CORS bucket yang mengizinkan origin website. Jangan menjadikan file publik untuk mengatasi masalah CORS.
