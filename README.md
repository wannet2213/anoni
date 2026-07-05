# Diskusi Anonimous

Aplikasi web untuk membuat ruang diskusi rahasia berbasis tautan. Peserta bergabung dan mengirim pesan real-time **tanpa registrasi, tanpa login, tanpa pencatatan IP**.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express + Socket.IO |
| Frontend | Next.js 14 + Tailwind CSS |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Auth | JWT + bcrypt |
| Proxy | Nginx (tanpa log IP) |
| Deploy | Docker Compose |

## Fitur

- **Registrasi & Login Admin** — JWT auth, password di-hash bcrypt
- **Dashboard Admin** — CRUD ruang diskusi, copy link undangan
- **Room Terproteksi** — Password room opsional (bcrypt hash)
- **Join Tanpa Login** — Akses via tautan, nickname bebas (default `Anonymous-XXXX`)
- **Chat Real-time** — Socket.IO, max 1000 karakter/ pesan
- **Hard Delete** — Hapus room = semua pesan hilang permanen
- **Tanpa Log IP** — Nginx dan backend tidak mencatat IP peserta

## Menjalankan

```bash
# Clone
git clone git@github.com:wannet2213/anoni.git
cd anoni

# Setup backend env
cp backend/.env.example backend/.env
# Edit JWT_SECRET jika perlu

# Jalankan semua service
docker compose up -d --build

# Cek status
docker compose ps
```

Akses aplikasi di `http://localhost`.

## Struktur Proyek

```
ano/
├── docker-compose.yml
├── nginx/
│   └── nginx.conf          # Reverse proxy, no IP logging
├── backend/
│   ├── Dockerfile
│   ├── prisma/
│   │   └── schema.prisma   # User, Room, Message
│   └── src/
│       ├── index.js        # Express entry
│       ├── routes/
│       │   ├── auth.js     # Register, login
│       │   ├── rooms.js    # Admin CRUD rooms
│       │   └── public.js   # Public room info, verify, messages
│       ├── middleware/
│       │   └── auth.js     # JWT middleware
│       └── socket/
│           └── index.js    # Socket.IO handler
└── frontend/
    └── src/
        └── app/
            ├── page.js              # Landing
            ├── login/page.js        # Admin login
            ├── register/page.js     # Admin register
            ├── dashboard/page.js    # Room management
            └── room/[slug]/
                ├── page.js          # Join room
                └── chat/page.js     # Chat real-time
```

## License

MIT
