# Diskusi Anonimous (Anoni)

Aplikasi web untuk membuat ruang diskusi rahasia berbasis tautan. Peserta bergabung dan mengirim
pesan real-time **tanpa registrasi, tanpa login, tanpa pencatatan IP**. Admin (akun terverifikasi
email) membuat dan mengelola room.

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Backend | Node.js 22 + Express 4 + Socket.IO 4 |
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Database | PostgreSQL 17 |
| ORM | Prisma 5 |
| Auth | JWT (HS256) + bcrypt atas verifier (kata sandi tidak dikirim), verifikasi email |
| Proxy | Nginx (tanpa log IP) |
| Email | Resend API |

## Fitur

- **Registrasi & login admin** — kata sandi diturunkan di perangkat (PBKDF2 600.000 iterasi), yang
  tersimpan di server hanya bcrypt dari verifier; akun aktif setelah verifikasi email (link 1 jam)
- **Lupa & reset kata sandi** — token sekali pakai 15 menit + verifier kode pemulihan; reset otomatis
  mencabut token login lama dan membungkus ulang kunci ruang dengan kata sandi baru
- **Dashboard admin** — CRUD room, salin tautan undangan
- **Room terproteksi** — password room (bcrypt) menghasilkan *room access proof*: bukti berlaku 12 jam
  yang wajib dibawa untuk membaca riwayat pesan (REST `X-Room-Token`) maupun bergabung ke socket
- **Join tanpa login** — melalui tautan, nickname bebas (maks. 30 karakter)
- **Chat real-time** — Socket.IO, maksimum 1000 karakter per pesan
- **Enkripsi isi pesan di perangkat (E2EE)** — AES-256-GCM di browser; kunci ruang dibawa di
  fragmen tautan (`#k=`) dan disimpan juga di akun dalam bentuk terbungkus. Lihat bagian
  "Enkripsi pesan"
- **Hard delete** — menghapus room menghapus seluruh pesan (cascade)
- **Tanpa log IP** — Nginx mengosongkan `X-Forwarded-For`/`X-Real-IP` dan format log tidak memuat IP

## Model keamanan singkat

| Kontrol | Perilaku |
|---|---|
| Akses room | `/api/v1/rooms/public/*` memang publik; room berpassword hanya mengeluarkan data setelah `POST /verify` berhasil, dan bukti akses terikat ke **id room** (bukan slug) sehingga room yang dihapus lalu dibuat ulang tidak mewarisi akses |
| Token admin | `tokenVersion` ikut ditandatangani; `POST /reset-password` menaikkannya sehingga token lama (7 hari) langsung tidak berlaku |
| Validasi tipe | `password` non-string ditolak `400` sebelum menyentuh bcrypt; `process.on("unhandledRejection")` sebagai jaring pengaman |
| Cleanup cron | `DELETE /api/v1/auth/cleanup-expired` butuh header `X-Cleanup-Token` yang sama dengan env `CLEANUP_TOKEN`, dan hanya mengembalikan jumlah akun yang dihapus (tanpa email). Gagal-tertutup kalau env tidak diisi |
| Enumerasi akun | `resend-verification` dan `forgot-password` memberi jawaban seragam, dan tidak membatalkan link verifikasi yang masih berlaku |
| Origin tautan email | Diambil dari header `X-Anoni-Frontend-Origin` yang **hanya** diisi Nginx melalui `map $host` (allowlist domain) |

## Arah desain & aksesibilitas

- **Dua tema: terang (default) dan gelap, dengan tombol toggle.** Pilihan disimpan di
  `localStorage["theme"]`; kalau belum pernah dipilih, tema mengikuti `prefers-color-scheme`.
- **Tanpa kedipan saat memuat.** Skrip kecil di `layout.js` dijalankan sebagai elemen pertama di
  dalam `<body>`, sebelum konten apa pun di-parse, lalu menambahkan kelas `dark` ke `<html>`. Jangan
  memindahkannya ke `useEffect` — itu memunculkan kedipan putih untuk pengguna mode gelap.
  `<html>` memakai `suppressHydrationWarning` karena kelasnya sudah berubah sebelum React hydrate.
- **Warna lewat token, bukan nilai mentah.** Semua warna ada di `:root` dan `.dark` pada
  `globals.css` (`--anoni-bg`, `--anoni-surface`, `--anoni-border`, `--anoni-muted`, `--anoni-accent`, …)
  dan dipakai oleh kelas komponen. Utilitas Tailwind di JSX wajib punya pasangan `dark:` —
  termasuk `className` berupa template literal, karena itulah yang paling mudah terlewat.
  `bg-accent` dan `text-white` sengaja tanpa pasangan: putih di atas `#4F46E5` sudah 6.29:1, dan
  mencerahkan tombol di mode gelap justru menurunkannya di bawah 4.5:1.
- **Tipografi** — Inter dengan fallback `system-ui` untuk seluruh aplikasi (`font-sans` dan `font-display`).
- **Lebar kontainer adaptif lewat kelas `.page-shell`** (`globals.css`), bukan lagi cap `max-w-*`
  yang ditulis ulang di tiap halaman. Di bawah 1024 px: lebar penuh dengan padding 16 px (perilaku
  lama dipertahankan). Dari 1024 px ke atas: lebar mengikuti viewport dengan padding
  `clamp(2rem, 3vw, 4rem)`, dibatasi `max-width: 2560px`. Hasil terukur: isi memakai 94–95% lebar
  layar di 1280–2560 px (sebelumnya 45% di 2560 px). Header, section, dan footer **wajib memakai
  `.page-shell`**, kalau tidak isinya tidak sejajar (footer pernah meleset 16 px karena paddingnya
  dipasang di elemen luar).
  Jebakan: kelas `.shell` sudah dipakai kartu `.doppelrand` (`.doppelrand > .shell`), jadi kontainer
  halaman harus tetap bernama `.page-shell` — jangan digabung atau ditukar.
- **Tipografi ikut lebar layar, tapi panjang baris dijaga.** Judul dan paragraf memakai `clamp()`
  (h1 48 px di 375 px, 75 px di 1280 px, berhenti di 104 px). Blok paragraf tetap dibatasi dalam
  satuan `ch`/`max-w-*` supaya panjang baris bertahan di sekitar 70 karakter — kartu boleh melebar,
  teks di dalamnya tidak.
- **Kolom bertambah, bukan cuma melebar.** Grid "cara kerja" 1 → 2 kolom (768 px) → 3 kolom
  (1536 px, mosaik 2 baris); daftar ruang dashboard 1 kolom → 2 kolom (1536 px). Kolom chat sengaja
  tetap sempit: 672 px, menjadi 768 px di ≥1536 px.
- **Form tetap sempit** (`max-w-sm` di halaman auth, `max-w-3xl` di form buat ruang). Kolom isian
  selebar layar lebih sulit dipakai, jadi form tidak ikut melebar walau kontainernya fluid.
- **Target sentuh** minimal 44×44 px. Tombol memakai `.btn-emerald` / `.btn-glass` / `.btn-copy` /
  `.theme-toggle`, tautan teks memakai `.inline-link`. Jangan menambah aturan global yang memaksa
  ukuran pada semua `a`/`button`; pakai kelasnya, karena tautan di dalam paragraf akan ikut berubah
  jadi flex. Tautan juga harus memakai kelas itu di halaman error, bukan hanya di alur utama.
- **Kontras** teks normal minimal 4.5:1, batas kontrol dan ikon bermakna minimal 3:1 (WCAG AA).
  Nilai terang: `text-gray-700` ≈ 10.3:1, `text-gray-600` ≈ 7.5:1 di atas putih. Warna ikon punya
  token sendiri (`--anoni-icon-accent/-warn/-ok/-bad`) karena ikon di dalam chip berwarna gagal
  ambang 3:1 kalau memakai warna asli Tailwind (mis. `#FBBF24` di atas `amber-100` hanya 1.50:1).
  Border kontrol di mode gelap juga butuh token lebih terang: `#4B5563` hanya mencapai 2.33:1 di
  atas `#1A1E26`, jadi dipakai `#6B7280` (3.45:1).
- **Gerak** — tidak ada animasi CSS sama sekali. Transisi dimatikan lewat `prefers-reduced-motion:
  reduce` di `globals.css`. Menambah animasi baru berarti menambah kebutuhan uji baru.
- **Fokus** — `:focus-visible` memakai outline 3 px dengan offset, warnanya ikut tema
  (`--anoni-focus`), berlaku global.

Markup tema dihasilkan server; satu-satunya hal yang bergantung pada JS adalah pilihan tema itu
sendiri. Tanpa JS, halaman tampil terang dan tetap berfungsi.

## Enkripsi pesan (E2EE)

Ada dua lapis. Lapis pertama mengenkripsi isi pesan dengan kunci ruang. Lapis kedua menyimpan
kunci ruang itu di akun dalam bentuk terbungkus, supaya tidak bergantung pada tautan saja.

### Lapis 1: isi pesan

Isi pesan dan nickname dienkripsi di browser sebelum dikirim. Server tidak pernah menerima kunci
ruang maupun bentuk terbaca dari isi pesan.

- **Algoritma**: AES-256-GCM lewat `crypto.subtle`, IV acak 12 byte per pesan, kunci ruang acak
  32 byte. Bentuk tersimpan: `e2e1:<iv+ciphertext>` dalam base64url. Implementasi di
  `frontend/src/lib/crypto.js`, diuji di `frontend/tests/crypto.test.mjs`.
- **Kunci ruang dibawa di fragmen tautan** (`/room/<slug>#k=<kunci>`). Browser tidak mengirim
  fragmen ke server, jadi kunci itu tidak pernah masuk log akses, header, maupun basis data.
- **Yang masih diketahui server**: nama dan slug ruang, waktu pembuatan, jumlah pesan, waktu kirim
  tiap pesan, dan panjang ciphertext. Isi pesan dan nama panggilan tidak.
- **Nickname ikut dienkripsi** karena nama panggilan bisa memuat nama asli. Pemotongan panjang di
  server dibuat longgar (1024 karakter) supaya tidak memutus ciphertext di tengah.
- **Batas panjang**: server menerima isi sampai 8192 karakter supaya teks 1000 karakter tetap muat
  setelah dienkripsi, termasuk karakter 4 byte seperti emoji. Batas 1000 karakter berlaku di sisi
  pengguna.

### Lapis 2: kunci ruang disimpan di akun

Tautan tidak lagi satu-satunya tempat kunci. Kunci ruang juga tersimpan di akun, dalam bentuk
terbungkus, sehingga bisa dibuka lagi setelah ganti perangkat atau ganti kata sandi.

```
kata sandi akun (tetap di perangkat)
   └─ PBKDF2-SHA256, 600.000 iterasi + salt acak 16 byte   → masterKey
         ├─ HKDF "auth"            → authVerifier  → dikirim ke server, disimpan bcrypt
         └─ HKDF "wrap" (rahasia)  → dipakai membungkus kunci ruang

kode pemulihan (32 karakter, ditampilkan sekali saat daftar)
   ├─ HKDF "recovery-auth"        → recoveryVerifier → dikirim ke server, disimpan bcrypt
   └─ HKDF "recovery-wrap"        → dipakai membungkus kunci ruang sebagai cadangan
```

- **Kunci ruang dibungkus dua kali** dan bungkusan itu yang disimpan di tabel `room_keys`
  (`wrapped_password`, `wrapped_recovery`). Server tidak bisa membukanya: `wrap` dan
  `recovery-wrap` tidak pernah dikirim.
- **Login tidak lagi mengirim kata sandi.** Server menerima `authVerifier`. Kata sandi asli hanya
  hidup di perangkat. Konsekuensinya kekuatan kata sandi dijaga di sisi perangkat
  (`accountCrypto.js`), bukan di server.
- **Verifier tidak bisa membuka bungkusan.** `authVerifier` dan `wrap` sama-sama turunan
  `masterKey`, tetapi dipisahkan HKDF dengan label berbeda, dan pemisahan itu diuji.
- **Ruang tanpa kode pemulihan** ditandai `wrapped_recovery = "none"`. Ruang seperti itu masih bisa
  dibuka dengan kata sandi akun, tetapi tidak bisa dipulihkan kalau kata sandi lupa. Dashboard
  menampilkan panel untuk memasukkan kode pemulihan dan membungkus ulang ruang-ruang tersebut.
- **Kode pemulihan** berbentuk 8 kelompok 4 karakter (Crockford base32, tanpa huruf I, L, O, U).
  Dibaca dengan toleransi huruf kecil, spasi, dan huruf yang mudah tertukar.
- **Mengganti kata sandi** memakai token email **dan** verifier kode pemulihan. Kunci ruang dibuka
  dengan kode itu di perangkat, lalu dibungkus ulang dengan kata sandi baru dan dikirim bersama
  permintaan reset (`rewrapped`). Tanpa kode pemulihan, reset kata sandi tetap bisa dilakukan lewat
  token email, tetapi riwayat ruang tidak bisa dibuka lagi.
- **Akun lama** (dibuat sebelum fitur ini) diangkat sekali saat login: kata sandi dikirim satu kali
  terakhir, klien menurunkan verifier, `POST /auth/kdf-upgrade` menyimpannya, dan kode pemulihan
  ditampilkan. Setelah itu jalur lama mati untuk akun tersebut.

### Batas jaminan, jangan dilebih-lebihkan saat promosi

1. **Kata sandi akun atau kode pemulihan tetap satu-satunya jalan masuk.** Bungkusan kunci ada di
   server, tetapi tanpa salah satu dari keduanya isinya tidak bisa dibuka. Kalau keduanya hilang,
   riwayat ruang hilang, dan itu tidak bisa dipulihkan dari sisi server.
2. **Halaman web ini dikirim oleh server yang sama.** Pemilik server yang sengaja menyisipkan kode
   jahat ke halaman tetap bisa mencuri kunci dari browser saat pengguna membuka kuncinya. Enkripsi
   ini melindungi dari kebocoran basis data dan cadangan, bukan dari server yang aktif menyerang
   penggunanya. Kalimat promosi yang benar: "server tidak menyimpan bentuk terbacanya", bukan
   "mustahil dibaca siapa pun".
3. **Kata sandi yang lemah melemahkan lapis ini.** PBKDF2 600.000 iterasi memperlambat tebakan,
   tetapi kata sandi pendek tetap bisa ditebak dari bungkusan yang bocor. Karena itu panjang minimum
   6 karakter adalah aturan di perangkat, bukan jaminan kekuatan.
4. **Pesan lama tidak terenkripsi.** Ruang yang dibuat sebelum fitur ini aktif berisi teks biasa,
   ditandai "ditulis sebelum enkripsi aktif", dan perlu ditekan "Aktifkan enkripsi" di dashboard.
5. **Kata sandi ruang bukan kunci enkripsi.** Kata sandi mengatur siapa yang boleh masuk, kunci di
   akun mengatur siapa yang bisa membaca. Keduanya sengaja dipisah.
6. **Fitur server yang butuh isi pesan tidak mungkin** (pencarian, moderasi, ekspor). Dashboard hanya
   menampilkan jumlah pesan.
7. **Kunci akun hanya hidup selama tab.** `masterKey` disimpan di `sessionStorage` dan daftar kunci
   ruang yang sudah dibuka juga sesi. Menutup tab berarti perlu membuka kunci lagi dengan kata sandi.
   Ini disengaja: kunci tidak ditulis ke penyimpanan permanen.

### Perilaku antarmuka yang menyertai

- Peserta tanpa kunci: halaman gabung memberi peringatan, tombol gabung menolak dengan pesan jelas,
  dan halaman chat menampilkan "Kunci enkripsi tidak ada".
- **Kunci yang terpotong dikenali sebagai rusak**, bukan dicoba lalu gagal diam-diam. Kunci ruang
  selalu 43 karakter base64url, dan `isValidRoomKey()` memeriksanya. Alasannya nyata: fragmen tautan
  bisa terpotong saat tautan disalin lewat aplikasi pesan.
- **Ada jalan pemulihan**: di halaman gabung maupun di layar "Kunci enkripsi tidak ada" tersedia
  kolom untuk menempel kunci ruang secara manual, lewat komponen `KeyPrompt.jsx`. Tanpa ini, halaman
  tersebut jadi jalan buntu dan satu-satunya saran adalah menghubungi pembuat ruang.
- Kegagalan enkripsi saat bergabung ditangkap dan ditampilkan, bukan dibiarkan menggantung di status
  "Menyambung...". Sebelum diperbaiki, janji yang gagal di jalur `encryptText` membuat halaman
  berhenti tanpa penjelasan.
- Pesan yang gagal dibuka karena kunci berbeda ditampilkan sebagai "tidak bisa dibuka dengan kunci
  yang ada di perangkat ini", bukan sebagai pesan kosong.
- Tautan yang disalin pengelola selalu memuat fragmen kunci. Ruang yang kuncinya tidak ada di browser
  itu menampilkan tombol "Aktifkan enkripsi", bukan tombol salin yang menghasilkan tautan mati.

## Bahasa copy

Sasaran pembaca: pengguna awam (staf kantor, guru, pengurus organisasi), bukan orang IT.

- **Pakai kata sehari-hari.** `kata sandi` bukan `password`, `catatan aktivitas` bukan `log`,
  `ruang` bukan `room`, dan jelaskan `alamat IP` saat pertama menyebutnya.
- **Istilah teknis dijelaskan sekali pakai** kalau memang tidak bisa dihindari. Contoh di `page.js`:
  "Alamat IP itu nomor pengenal sambungan internet Anda".
- **Jangan sebut nama alat internal di teks yang dibaca pengguna.** `Nginx`, `header`,
  `X-Forwarded-For`, dan `log_format` hanya boleh muncul di README atau komentar kode, bukan di
  halaman. Kartu privasi di homepage pernah menulis "Konfigurasi Nginx mengosongkan header alamat IP",
  dan itu tidak terbaca oleh pembaca non-teknis.
- **Kalimat pendek.** Jaga rata-rata di bawah 10 kata dan jangan ada kalimat di atas 20 kata. Angka
  homepage saat ini: 8,7 kata per kalimat, 0 kalimat di atas 20 kata.
- **Klaim harus sempit dan terbukti.** Tulis yang benar-benar dilakukan sistem, bukan kesimpulan yang
  lebih luas. Konfigurasi aktif (`log_format anon` tanpa IP, `X-Forwarded-For` dikosongkan) mendukung
  kalimat "alamat IP tidak diteruskan ke aplikasi dan tidak masuk catatan aktivitas aplikasi", bukan
  "tidak bisa dilacak sama sekali" karena jaringan di depan situs tetap melihat lalu lintasnya.
- Pemeriksa: `node /root/reports/anoni/copy/check-jargon.mjs`, memuat homepage lalu melaporkan istilah
  teknis yang tersisa dan panjang kalimat.

## Kontrak error API

Semua pesan error yang sampai ke pengguna berbahasa Indonesia, ditulis di backend. `src/lib/api.js`
melempar `Error` dengan properti `status`, dan UI memilih perilaku berdasarkan **status**, bukan
teks pesan — jangan kembali ke `err.message.includes(...)`.

| `status` | Arti | Perilaku UI |
|---|---|---|
| `0` | fetch gagal, server tidak terhubung | pesan koneksi + tombol "Coba lagi" |
| `401` | kredensial salah, atau sesi admin kedaluwarsa | login: pesan salah; dashboard: hapus token lalu ke `/login` |
| `403` | login: email belum diverifikasi. Room: perlu kata sandi | login: panel "Email Belum Terverifikasi"; room: kembali ke halaman join |
| `404` | room atau token tidak ada | halaman "Room tidak ditemukan" |
| `410` | tautan verifikasi/reset kedaluwarsa | tawarkan kirim ulang |
| `5xx` | backend mati / proxy menjawab 502 | "Server sedang bermasalah" + tombol "Coba lagi" |

Balasan non-JSON (mis. halaman HTML dari proxy) tidak boleh membuat halaman pecah; `api.js` sudah
menanganinya, dan pesan hanya diambil dari field `error` kalau bentuknya JSON.

## Menjalankan (native systemd — jalur yang dipakai di server ini)

```bash
# 1. Dependensi & database
cd backend && npm install && npm run generate
npm run migrate                 # prisma migrate deploy (butuh DATABASE_URL)

# 2. Env backend
cp backend/.env.example backend/.env   # lalu isi nilainya (lihat tabel di bawah)

# 3. Frontend
cd frontend && npm install && npm run build

# 4. Layanan
systemctl enable --now postgresql anoni-backend anoni-frontend nginx
```

Unit systemd yang dipakai di server ini disertakan di `systemd/` (`anoni-backend.service` dan
`anoni-frontend.service`). Sesuaikan `WorkingDirectory`, `EnvironmentFile`, dan path node sebelum
dipakai di mesin lain.

Frontend dijalankan dengan `next start -p 3000`. Nginx mem-proxy `/api/` dan `/socket.io/` ke
`127.0.0.1:4000` serta `/` ke `127.0.0.1:3000`; konfigurasi aslinya ada di
`nginx/nginx.native.conf` (salinan dari `/etc/nginx/nginx.conf` di server ini).

Aplikasi **wajib disajikan lewat HTTPS** (atau `localhost`). `crypto.subtle` tidak tersedia di
konteks tidak aman, jadi membuka aplikasi lewat `http://` pada host sungguhan membuat enkripsi
gagal — dan pengguna hanya melihat pesan "perangkat tidak mendukung enkripsi".

## Environment backend

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | koneksi PostgreSQL |
| `JWT_SECRET` | ya | kunci HS256 untuk token admin **dan** bukti akses room |
| `PORT` | tidak | default `4000` |
| `HOST` | tidak | default `127.0.0.1`; set `0.0.0.0` hanya bila backend diakses langsung tanpa Nginx |
| `FRONTEND_URL` | tidak | origin untuk CORS (`http://localhost:3000` di dev) |
| `RESEND_API_KEY` | ya untuk email | kunci Resend |
| `RESEND_FROM` | tidak | alamat pengirim, mis. `Anoni <noreply@example.com>` |
| `CLEANUP_TOKEN` | untuk cron | header `X-Cleanup-Token` untuk `cleanup-expired` |

Header `X-Anoni-Frontend-Origin` **tidak** diisi klien: Nginx menurunkannya dari `map $host` supaya
tautan email selalu memakai domain tepercaya. Menambah domain baru = menambah satu baris di `map`
tersebut lalu `nginx -t && systemctl reload nginx`.

## Tes

```bash
cd backend && npm test           # node --test: logika origin tautan email + bukti akses room
```

Belum ada tes otomatis untuk frontend maupun uji end-to-end. Perubahan UI diverifikasi manual:
build produksi, lalu pemeriksaan kontras, target sentuh, dan state error di browser.

## Struktur Proyek

```
anoni/
├── systemd/                 # unit layanan yang dipakai di server (salinan dari host)
│   ├── anoni-backend.service
│   └── anoni-frontend.service
├── nginx/
│   └── nginx.native.conf   # salinan /etc/nginx/nginx.conf (systemd + Nginx native)
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma   # User, Room, Message, VerificationToken, PasswordResetToken
│   │   └── migrations/
│   ├── test/               # node --test
│   └── src/
│       ├── index.js        # Express entry (rute publik dipasang sebelum rute admin)
│       ├── email.js        # pengiriman verifikasi & reset via Resend
│       ├── routes/
│       │   ├── auth.js     # register, login, verify, reset, cleanup
│       │   ├── rooms.js    # CRUD room (JWT)
│       │   └── public.js   # info room, verify password, riwayat pesan
│       ├── middleware/
│       │   └── auth.js     # JWT admin, tokenVersion, bukti akses room
│       └── socket/
│           └── index.js    # join_room, message, leave_room
└── frontend/
    └── src/
        ├── lib/            # api.js, socket.js
        └── app/
            ├── page.js, login/, register/, dashboard/
            ├── forgot-password/, reset-password/, verify/
            └── room/[slug]/         # join + chat
```

## License

MIT
