const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");
const { verifyRoomToken } = require("../middleware/auth");

const prisma = new PrismaClient();

// Isi pesan dan nickname tiba dari browser dalam bentuk terenkripsi (lihat
// frontend/src/lib/crypto.js). Server tidak memegang kuncinya, jadi keduanya
// diperlakukan sebagai data buram: yang dijaga hanya batas panjang, bukan isinya.
// Batas ini harus memuat teks 1000 karakter SETELAH dienkripsi, termasuk karakter
// 4 byte seperti emoji yang mengembang 4x sebelum menjadi base64.
const MAX_CONTENT_CHARS = 8192;
const MAX_NICKNAME_CHARS = 1024;
// Nickname bawaan ini konstanta, bukan data pengguna, jadi boleh dalam bentuk terbaca.
const DEFAULT_NICKNAME = "Anonim";

function asOpaqueText(value, maxChars, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxChars) : fallback;
}

function setupSocket(server) {
  const io = new Server(server, {
    // ponytail: sockets are same-origin in this deployment (nginx proxies them); the real control is
    // the room access proof below, not the Origin header.
    cors: { origin: "*" },
    pingTimeout: 60000,
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join_room", async ({ slug, nickname, roomToken } = {}, callback) => {
      try {
        const room = await prisma.room.findUnique({ where: { slug } });
        if (!room) {
          if (callback) callback({ error: "Room tidak ditemukan" });
          return;
        }
        if (room.passwordHash && !verifyRoomToken(roomToken, room.id)) {
          if (callback) callback({ error: "Room ini memerlukan kata sandi" });
          return;
        }

        socket.data.roomSlug = slug;
        // Nickname dipakai apa adanya; memotongnya di tengah akan merusak data terenkripsi.
        socket.data.nickname = asOpaqueText(nickname, MAX_NICKNAME_CHARS, DEFAULT_NICKNAME);
        socket.join(slug);

        io.to(slug).emit("user_joined", {
          nickname: socket.data.nickname,
          timestamp: new Date().toISOString(),
        });

        if (callback) callback({ success: true, nickname: socket.data.nickname });
      } catch (err) {
        if (callback) callback({ error: "Gagal bergabung ke room" });
      }
    });

    socket.on("message", async ({ content }, callback) => {
      const { roomSlug, nickname } = socket.data;
      const payloadText = asOpaqueText(content, MAX_CONTENT_CHARS);
      const sender = nickname || DEFAULT_NICKNAME;
      if (!roomSlug || !payloadText) {
        if (callback) callback({ error: "Pesan tidak valid" });
        return;
      }

      try {
        const room = await prisma.room.findUnique({ where: { slug: roomSlug } });
        if (!room) {
          if (callback) callback({ error: "Room tidak ditemukan" });
          return;
        }

        const message = await prisma.message.create({
          data: {
            content: payloadText,
            nickname: sender,
            roomId: room.id,
          },
        });

        const payload = {
          id: message.id,
          content: message.content,
          nickname: message.nickname,
          createdAt: message.createdAt.toISOString(),
        };

        io.to(roomSlug).emit("new_message", payload);
        if (callback) callback({ success: true, message: payload });
      } catch (err) {
        if (callback) callback({ error: "Pesan gagal terkirim" });
      }
    });

    socket.on("leave_room", () => {
      const { roomSlug } = socket.data;
      if (roomSlug) {
        socket.leave(roomSlug);
        io.to(roomSlug).emit("user_left", { nickname: socket.data.nickname });
      }
    });

    socket.on("disconnecting", () => {
      const { roomSlug, nickname } = socket.data;
      if (roomSlug) {
        io.to(roomSlug).emit("user_left", { nickname });
      }
    });
  });

  return io;
}

module.exports = setupSocket;
