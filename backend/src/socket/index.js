const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function setupSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*" },
    pingTimeout: 60000,
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join_room", async ({ slug, nickname }, callback) => {
      try {
        const room = await prisma.room.findUnique({ where: { slug } });
        if (!room) {
          if (callback) callback({ error: "Room not found" });
          return;
        }

        socket.data.roomSlug = slug;
        socket.data.nickname = nickname || `Anonymous-${Math.floor(1000 + Math.random() * 9000)}`;
        socket.join(slug);

        io.to(slug).emit("user_joined", {
          nickname: socket.data.nickname,
          timestamp: new Date().toISOString(),
        });

        if (callback) callback({ success: true, nickname: socket.data.nickname });
      } catch (err) {
        if (callback) callback({ error: "Join failed" });
      }
    });

    socket.on("message", async ({ content }, callback) => {
      const { roomSlug, nickname } = socket.data;
      if (!roomSlug || !content || content.length > 1000) {
        if (callback) callback({ error: "Invalid message" });
        return;
      }

      try {
        const room = await prisma.room.findUnique({ where: { slug: roomSlug } });
        if (!room) {
          if (callback) callback({ error: "Room not found" });
          return;
        }

        const message = await prisma.message.create({
          data: {
            content: content.slice(0, 1000),
            nickname: nickname || "Anonymous",
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
        if (callback) callback({ error: "Message failed" });
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
