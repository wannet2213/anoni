# Diskusi Anonimous — Project Brief & PRD

> **Status:** PLANNING — Siap untuk development.
> **Purpose:** Single source of truth untuk visi produk, user stories, arsitektur, dan implementation guide.

---

## BAGIAN I — PROJECT BRIEF

### 1. Vision

#### Elevator Pitch
Diskusi Anonimous adalah aplikasi web responsif yang memungkinkan profesional untuk membuat ruang diskusi rahasia berbasis tautan, tempat peserta dapat bergabung dan mengirim pesan teks real-time tanpa registrasi, login, atau pelacakan identitas.

#### Problem Statement
- Karyawan/klien enggan berbagi pendapat jujur dalam rapat formal karena takut identitas tercatat.
- Tool meeting konvensional (Zoom, Google Meet) merekam log IP, email, dan identitas, mengurangi anonimitas.
- Butuh solusi ringan untuk diskusi informal cepat tanpa instalasi aplikasi.
- Risiko kebocoran data rapat karena platform menyimpan metadata peserta.

#### Target Users
| Role | Deskripsi | Kebutuhan Utama |
|------|-----------|------------------|
| Admin (Inisiator Diskusi) | Profesional yang ingin mengadakan sesi diskusi rahasia, misalnya manager tim atau HR | Membuat dan mengelola ruang diskusi; membagikan tautan; opsional melindungi ruang dengan kata sandi; melihat forum secara real-time |
| Peserta Anonim (Partisipan) | Kolega, klien, atau siapapun yang diundang melalui tautan | Bergabung tanpa registrasi; langsung mengirim pesan teks; nama bebas; tanpa log IP atau identitas permanen |

### 2. Tech Stack

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Backend Framework | Node.js + Express | 20+ | Performa tinggi, ekosistem rich, cocok untuk real-time |
| Real-time Engine | Socket.IO | 4.x | WebSocket abstrak dengan fallback, room support, mudah integrasi |
| Frontend Framework | Next.js | 14+ (App Router) | React dengan SSR opsional, performa, developer experience baik |
| Styling | Tailwind CSS | 3.4+ | Utility-first, cepat styling, mudah responsif |
| Database | PostgreSQL | 16+ | Relasional kuat, transaksi, cocok untuk data permanen (admin, room) |
| Cache & Pub/Sub | Redis | 7.x | Caching session ringan, adapter Socket.IO untuk skalabilitas, penyimpanan pesan opsional |
| ORM | Prisma | 5.x | Type-safe, mudah migrasi, mendukung PostgreSQL |
| Authentication | JWT | - | Stateless, ringan, cocok untuk single page application |
| Web Server/Proxy | Nginx | 1.24+ | Reverse proxy, SSL termination, basic rate limiting |
| Containerization | Docker | 24+ | Lingkungan seragam, mudah deployment |
| Monitoring | Prometheus + Grafana | - | Opsional untuk metrik server (P2) |

### 3. UI/UX Direction

| Item | Value |
|------|-------|
| Framework UI | Tailwind CSS + Headless UI |
| Theme | Light mode (default), dark mode opsional (toggle) — **MVP hanya Light** |
| Color Palette | Primary: `#4F46E5` (Indigo), Secondary: `#E0E7FF`, Background: `#F9FAFB`, Text: `#111827` |
| Typography | Inter (Sans-serif), fallback system-ui |

### 4. Core Features (MVP)

1. **Pendaftaran & Login Admin** — Register dengan email/username, password; login memperoleh JWT.
2. **Dashboard Admin** — Melihat daftar ruang yang dibuat, membuat ruang baru, menghapus ruang.
3. **Pembuatan Ruang Diskusi** — Admin menetapkan nama ruang, slug unik otomatis/generate, atur kata sandi opsional.
4. **Tautan Undangan** — Setiap ruang memiliki URL publik (misal `/room/[slug]`), dibagikan via salinan.
5. **Join Tanpa Login** — Peserta mengakses tautan, memasukkan nickname opsional (default “Anonymous”), memasukkan kata sandi jika room protected, lalu masuk ke chat.
6. **Chat Real-time** — Kirim pesan teks, langsung muncul di semua peserta tanpa refresh, menggunakan Socket.IO.
7. **Tanpa Log IP & Jejak Identitas** — Vercel/nginx dikonfigurasi tidak mencatat IP, backend tidak menyimpan IP di database atau log aplikasi.
8. **Penghapusan Ruang** — Admin dapat menghapus ruang, semua pesan langsung terhapus (hard delete).

### 5. Non-Goals / Out of Scope

- Manajemen user/peserta (tidak ada daftar peserta, blockir, kick).
- Upload file atau gambar.
- Pesan suara/video.
- Enkripsi end-to-end pesan (hanya TLS transport).
- Mobile app native (hanya responsive web).
- History pesan lintas sesi bagi peserta (peserta hanya melihat pesan sejak ia join).
- Fitur polling, Q&A terstruktur.

### 6. User Roles & Permissions

| Role | Deskripsi | Level Akses | Module Scope |
|------|-----------|-------------|--------------|
| Admin | Pengguna terdaftar yang membuat ruang | CRUD room miliknya, kirim pesan di room sendiri, hapus pesan (P2), hapus room | Autentikasi, Dashboard Room, Chat Room (sebagai Admin) |
| Anonymous Participant | Pengguna tidak terdaftar, bergabung via tautan | Kirim pesan, lihat pesan real-time di room yang diakses | Join Room, Chat |

### 7. Core Business Logic & Rules

- **JIKA** admin menghapus ruang, **MAKA** semua pesan di dalamnya langsung dihapus permanen dari database (hard delete).
- **JIKA** room memiliki kata sandi, **MAKA** peserta harus memasukkan kata sandi yang benar via halaman join sebelum terhubung ke WebSocket.
- **JIKA** tautan room tidak valid (slug tidak ditemukan atau room dihapus), **MAKA** tampilkan halaman 404.
- **JIKA** admin yang login mengakses room miliknya, **MAKA** ia otomatis masuk chat dengan nickname “Admin” tanpa kata sandi (atau lewat dashboard).
- **JIKA** peserta anonim masuk, **MAKA** nickname defaultnya adalah “Anonymous-XXXX” (angka acak 4 digit) jika tidak diisi.
- **JIKA** server restart, **MAKA** pesan yang sudah tersimpan di database tetap ada; koneksi WebSocket terputus dan klien reconnect otomatis.
- **JIKA** admin belum login, **MAKA** tidak bisa mengakses dashboard, tetapi bisa bergabung ke room sebagai peserta anonim (jika tau tautannya).

### 8. Key Workflows

#### 8.1 Pembuatan Room
1. Admin login ke dashboard.
2. Klik “Buat Room Baru”.
3. Isi nama room, kata sandi (opsional), slug otomatis atau custom (unique).
4. Submit → room tersimpan di DB, redirect ke detail room dengan tautan undangan.
5. Tautan dapat disalin, share via email/chat.

#### 8.2 Peserta Join & Chat
1. Peserta menerima tautan `https://app.com/room/<slug>`.
2. Halaman join menampilkan input nickname (prefilled “Anonymous-rand”), input kata sandi jika room protected.
3. Submit → validasi kata sandi via REST API, dapatkan room info.
4. Redirect ke halaman chat; inisiasi koneksi Socket.IO.
5. Peserta dapat mengetik pesan, kirim. Pesan muncul langsung di semua peserta termasuk pengirim.
6. Saat peserta keluar (tutup tab), koneksi putus.

#### 8.3 Admin Moderasi (Hapus Room)
1. Admin login, buka dashboard.
2. Lihat daftar room, klik “Hapus” pada room tertentu.
3. Konfirmasi modal → room dan semua pesan dihapus permanen.
4. Jika peserta sedang berada di room tersebut, WebSocket akan memutuskan dan menampilkan pesan “Room dihapus”.

### 9. Integration Points

| Service | Type | Purpose | Auth Method | Critical? |
|---------|------|---------|-------------|-----------|
| Redis | Cache | Adapter Socket.IO untuk multi-instance, session singkat | Password opsional | Tidak (untuk single instance MVP bisa tanpa Redis, tapi digunakan untuk room socket broadcast skala) |
| PostgreSQL | Database | Simpan admin, room, dan pesan | Kredensial DB | Ya |
| Socket.IO Server | Self-hosted | Real-time messaging | (terintegrasi dengan Express) | Ya |
| Nginx | Proxy | SSL, reverse proxy ke backend, disable IP logging | - | Ya |

### 10. Success Criteria

| Metric | Target | Cara Ukur |
|--------|--------|-----------|
| Waktu pembuatan room | < 2 detik | Backend response time |
| Latensi pengiriman pesan (end-to-end) | < 500 ms | WebSocket round-trip |
| Kemampuan peserta per room | > 100 simultaneous | Load test dengan WebSocket connection |
| Tautan room mudah dibagikan | Cukup salin tautan | Feedback pengguna (survey) |
| Tidak ada log IP di backend | 0 IP tersimpan | Audit log aplikasi, konfigurasi nginx |
| Jumlah room yang dapat dibuat admin | Tak terbatas | -

### 11. Final Goal / North Star

Memberikan sarana diskusi rahasia instan tanpa jejak identitas sehingga setiap profesional dapat bertukar pikiran secara bebas dan aman.

---

## BAGIAN II — PRODUCT REQUIREMENTS

### 12. User Stories & Acceptance Criteria

**Epic 1: Autentikasi Admin**
| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|----------------------|
| US-001 | Sebagai Admin, saya ingin mendaftar akun dengan email dan password agar dapat mengakses sistem | P0 | 1. Form registrasi menerima email (valid) dan password (min 6 karakter). 2. Email harus unik. 3. Password di-hash. 4. Setelah daftar, langsung login dan redirect ke dashboard. 5. Jika email sudah terdaftar, tampilkan error. |
| US-002 | Sebagai Admin, saya ingin login ke akun yang sudah terdaftar agar dapat mengelola room | P0 | 1. Terima email/username dan password. 2. Verifikasi dengan database, kembalikan JWT. 3. JWT disimpan di httpOnly cookie (opsional) atau localStorage untuk Next.js. 4. Dashboard hanya bisa diakses dengan JWT valid. 5. Jika gagal, tampilkan pesan error. |

**Epic 2: Manajemen Room**
| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|----------------------|
| US-003 | Sebagai Admin, saya ingin membuat room diskusi baru dengan nama dan kata sandi opsional agar bisa mengundang peserta | P0 | 1. Terima input nama (wajib), kata sandi (opsional). 2. Slug dibuat otomatis (misal `room-abc123`) unik, atau admin bisa memasukkan custom. 3. Room disimpan dengan relasi ke user. 4. Kembalikan detail room termasuk slug, nama, dan link undangan. |
| US-004 | Sebagai Admin, saya ingin menyalin tautan undangan room agar mudah dibagikan | P0 | 1. Di halaman detail room, tampilkan URL lengkap `/room/<slug>`. 2. Tombol salin tautan ke clipboard. 3. Tautan tetap berfungsi selama room ada. |
| US-005 | Sebagai Admin, saya ingin menghapus room yang sudah tidak diperlukan | P0 | 1. Di dashboard, setiap room memiliki tombol hapus. 2. Konfirmasi sebelum hapus. 3. Room dan semua pesan terhapus permanen. 4. WebSocket broadcast “room_deleted” ke semua peserta di room tersebut. |
| US-006 | Sebagai Admin, saya ingin melihat daftar room yang saya buat | P0 | 1. Dashboard menampilkan tabel/list room milik admin login. 2. Setiap item menunjukkan nama, slug, tanggal dibuat, jumlah pesan (opsional). 3. Klik room untuk masuk ke chat. |
| US-007 | Sebagai Admin, saya ingin mengedit nama dan kata sandi room | P1 | 1. Edit room memungkinkan ubah nama dan kata sandi. 2. Slug tidak bisa diubah. 3. Perubahan tersimpan, link tetap sama. |

**Epic 3: Partisipasi Anonymous**
| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|----------------------|
| US-008 | Sebagai Peserta Anonymous, saya ingin bergabung ke room diskusi dengan mengklik tautan tanpa perlu login | P0 | 1. Halaman `/room/<slug>` memuat form join tanpa autentikasi. 2. Jika room tidak ada, tampilkan 404. 3. Jika room ada, tampilkan input nickname dan kata sandi (jika protected). 4. Setelah submit, redirect ke halaman chat. |
| US-009 | Sebagai Peserta Anonymous, saya ingin memasukkan kata sandi room jika diproteksi | P0 | 1. Jika room memiliki password_hash tidak null, endpoint verifikasi password diakses saat join. 2. Jika password benar, peserta dapat masuk; jika salah, tampilkan error. 3. Setelah password benar, session ringan (JWT pendek atau cookie) agar tidak perlu masukkan password lagi selama session. |
| US-010 | Sebagai Peserta Anonymous, saya ingin mengirim pesan teks ke room secara real-time | P0 | 1. Text input di bagian bawah chat. 2. Pesan dikirim via Socket.IO. 3. Pesan muncul di semua peserta termasuk pengirim. 4. Tidak ada delay refresh halaman. 5. Maks panjang pesan 1000 karakter. |
| US-011 | Sebagai Peserta Anonymous, saya ingin melihat pesan yang dikirim oleh peserta lain secara langsung | P0 | 1. Saat koneksi WebSocket terbentuk, server mengirim riwayat pesan room dari DB (opsional: hanya 50 pesan terakhir). 2. Setiap pesan baru broadcast ke semua klien di room. 3. UI menampilkan bubble chat dengan nickname dan timestamp. |
| US-012 | Sebagai Peserta Anonymous, saya ingin menetapkan nickname saat bergabung agar pesan saya dikenal | P1 | 1. Input nickname tersedia di form join. 2. Default nickname “Anonymous-XXXX”. 3. Nickname berlaku untuk semua pesan yang dikirim sesi tersebut. |

**Epic 4: Moderasi & Keamanan**
| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|----------------------|
| US-013 | Sebagai Admin, saya ingin menghapus pesan tertentu di room saya | P2 | (Future) 1. Admin bisa klik ikon hapus di pesan. 2. Pesan akan dihapus dari DB dan di-broadcast ke peserta untuk dihapus dari UI. |
| US-014 | Sebagai Admin, saya ingin room saya tidak menyimpan IP peserta atau data identitas | P0 | 1. Backend tidak mencatat IP di log (baik Express request maupun Socket.IO handshake). 2. Nginx configuration `log_format` tanpa IP. 3. Tidak ada kolom IP di tabel database. 4. Audit: cek source code tidak ada penyimpanan IP. |

### 13. Feature Priority Matrix

#### MVP (P0)
| # | Fitur | Deskripsi | Epic |
|---|-------|-----------|------|
| 1 | Registrasi & Login Admin | Register, login, JWT | Authentikasi |
| 2 | Dashboard Admin | Daftar room, create, delete room | Manajemen Room |
| 3 | Pembuatan Room | Buat room dengan nama, password opsional, slug, link undangan | Manajemen Room |
| 4 | Join via Tautan | Halaman join tanpa login, input nickname & password jika ada | Partisipasi |
| 5 | Chat Real-time | Kirim/terima pesan via Socket.IO, riwayat pesan dari DB | Partisipasi & Real-time |
| 6 | Penghapusan Room | Admin hapus room, semua data hilang | Manajemen Room |
| 7 | Tanpa Log IP | Nginx konfigurasi, backend tidak log IP | Keamanan |

#### Post-MVP (P1)
| # | Fitur | Deskripsi |
|---|-------|-----------|
| 1 | Edit Room | Ubah nama & password room |
| 2 | Custom Nickname | Input nama sendiri saat join |
| 3 | Load More Chat | Infinite scroll pesan terdahulu |
| 4 | Dark Mode | Toggle dark/light |

#### Future (P2)
| # | Fitur | Deskripsi |
|---|-------|-----------|
| 1 | Admin Hapus Pesan | Admin bisa hapus pesan tertentu |
| 2 | Typing Indicator | Broadcast siapa yang sedang mengetik |
| 3 | Kapasitas Room Limit | Batasi jumlah peserta sesuai paket |

### 14. Constraints & Assumptions

#### Constraints
- Hanya ada satu server backend untuk MVP (skalabilitas dengan Redis adapter disiapkan tapi tidak wajib).
- Jumlah peserta per room maksimal 100 (harus di-load test).
- Tidak ada moderasi otomatis konten (tidak ada filter kata kasar).
- Hanya web responsive, tidak ada mobile app.

#### Assumptions
- Pengguna Admin menggunakan browser modern (Chrome, Firefox, Safari versi terbaru).
- Jaringan internet stabil untuk real-time.
- Admin bertanggung jawab atas konten diskusi, platform hanya sebagai penyedia.
- Keamanan password room menggunakan bcrypt hash, bukan enkripsi tingkat militer.
- Proyek akan di-deploy di VPS kecil (2GB RAM) menggunakan Docker Compose.

### 15. Test Plan

| Modul | Test Type | Tools | Coverage Target |
|-------|-----------|-------|-----------------|
| Backend API | Unit test (controller, service) | Jest, Supertest | 80% |
| Database query | Unit test (prisma mock) | Jest | 80% |
| Socket.IO | Integration test (WebSocket connection) | Jest + socket.io-client | Semua event utama (join, message, room_delete) |
| Frontend Pages | Unit test (komponen) | React Testing Library, Jest | 70% |
| UI Workflow | E2E (happy path) | Playwright/Cypress | Pendaftaran, login, buat room, join room, chat, hapus room |
| Performance | Load test | k6 atau Artillery | 100 concurrent WebSocket di satu room, latensi < 500ms |
| Security | Manual pen-test | Burp/OWASP Zap | Cek kebocoran IP, CSRF token, XSS di chat, bruteforce password |

---

## BAGIAN III — ARCHITECTURE

### 16. System Design

#### Architecture Pattern
Monolithic-backend (Express + Socket.IO), terintegrasi frontend Next.js. Menggunakan pendekatan server tunggal untuk kemudahan development MVPs. Komunikasi API menggunakan REST, real-time menggunakan WebSocket. Redis opsional sebagai adapter Socket.IO untuk multi-instance (tidak dipakai di MVP, tapi kode siap).

#### High-Level Diagram
```text
Client (Browser)  -- HTTPS -->  Nginx (Reverse Proxy, SSL)  -- HTTP -->  Express Server (API + WS)
                                |
                                |-- melayani /api/* ke Express
                                |-- melayani WebSocket upgrade
Express Server
    ├── REST API (/api/v1/auth, /api/v1/rooms)
    ├── Socket.IO (ws://...)
    │     └── Namespace: /
    │          └── Events: join_room, message, leave_room, room_deleted
    ├── Prisma Client  -->  PostgreSQL (data permanen)
    └── Redis Client (opsional, pub/sub adapter)
```

### 17. Component Breakdown

| Komponen | Tipe | Tanggung Jawab | Teknologi |
|----------|------|----------------|-----------|
| NGINX | Backend Infra | SSL termination, reverse proxy, disable IP log | Docker, nginx.conf |
| Express App | Backend | REST API, middleware auth, error handling | Express 4.x |
| Socket.IO Server | Backend | Koneksi WebSocket, room management, broadcast, simpan pesan ke DB | socket.io, socket.io-redis (opsional) |
| Prisma ORM | Backend | Migrasi, query database type-safe | Prisma 5.x |
| PostgreSQL | Database | Penyimpanan user, room, message | PostgreSQL 16 |
| Next.js App | Frontend | UI interaktif, client-side routing, autentikasi via JWT, Socket.IO client | React, Next.js 14, Tailwind |
| Redis (opsional) | Cache | Adapter untuk multi-instance WebSocket | Redis 7 |

### 18. Routing Strategy

| Route Prefix | Middleware | Auth Requirement | Description |
|--------------|------------|------------------|-------------|
| `/api/v1/auth` | None (kecuali endpoint protected) | No auth untuk login/register; JWT untuk getProfile | Autentikasi admin |
| `/api/v1/rooms` | `authenticateAdmin` | JWT required | CRUD rooms milik admin |
| `/api/v1/rooms/public` | None | No auth | Public endpoint untuk verifikasi kata sandi room dan info room (join). |
| `/room/[slug]` | None (frontend page) | No auth | Halaman join room (public) |
| `/room/[slug]/chat` | None (frontend page) | No auth (bergantung pada session join) | Halaman chat room (dilindungi oleh validasi password jika ada) |
| `/dashboard` | Middleware client-side check token | JWT required | Halaman dashboard admin |
| WebSocket `/` | `socket.io` middleware verifikasi password room saat join | No auth, password verified on join | Real-time chat |

### 19. Data Flow

#### 19.1 Admin Membuat Room
```text
Client (Dashboard) -> POST /api/v1/rooms (JWT) -> Express -> Prisma create room -> DB
-> Response { room: { id, slug, name, password_protected, link } }
```

#### 19.2 Peserta Join Room yang Dilindungi Password
```text
Browser -> GET /room/<slug> (halaman join)
-> User submits nickname & password
-> POST /api/v1/rooms/public/<slug>/verify { password }
-> Server hash compare, if ok return { valid: true, room: {name, slug} }
-> Frontend redirect to /room/<slug>/chat?nickname=...
-> Inisiasi Socket.IO connection + emit 'join_room' (slug, nickname)
-> Server Socket.IO middleware verifikasi bahwa room ada, password terpenuhi (cek sesi cookie).
-> Server adds socket to room, emit 'user_joined', kirim riwayat pesan last 50.
```

#### 19.3 Pengiriman Pesan Real-time
```text
Participant types message -> click send
-> socket.emit('message', { room_slug, content })
-> Server (Socket.IO) on('message') -> validate room & nickname -> save to DB via Prisma -> broadcast to room (socket.to(room_slug).emit('new_message', data))
-> All clients in room receive 'new_message', add to UI
```

### 20. Security Plan

| Area | Strategy |
|------|----------|
| Authentication (Admin) | JWT (access token, expire 7 hari), disimpan di httpOnly cookie (opsi) atau localStorage. Password di-hash dengan bcrypt. |
| Authorization | Endpoint `/api/v1/rooms` hanya mengembalikan data milik user yang login (cek user ID dari JWT). |
| CSRF Protection | Gunakan SameSite=Strict pada cookie session jika pakai cookie. Token CSRF opsional karena pakai JWT di header Authorization. |
