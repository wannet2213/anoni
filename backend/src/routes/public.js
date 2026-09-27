const { Router } = require("express");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { signRoomToken, verifyRoomToken } = require("../middleware/auth");

const prisma = new PrismaClient();
const router = Router();

// Public: get room info (for join page)
router.get("/public/:slug", async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { slug: req.params.slug },
    select: { id: true, name: true, slug: true, passwordHash: true },
  });
  if (!room) return res.status(404).json({ error: "Room tidak ditemukan" });
  res.json({ room: { id: room.id, name: room.name, slug: room.slug, protected: !!room.passwordHash } });
});

// Public: verify room password and hand back a room access proof (no session, no cookie)
router.post("/public/:slug/verify", async (req, res) => {
  const { password } = req.body;
  if (typeof password !== "string" || !password) {
    return res.status(400).json({ error: "Kata sandi wajib diisi" });
  }

  const room = await prisma.room.findUnique({
    where: { slug: req.params.slug },
    select: { id: true, name: true, slug: true, passwordHash: true },
  });
  if (!room) return res.status(404).json({ error: "Room tidak ditemukan" });

  if (!room.passwordHash) {
    return res.json({ valid: true, room: { name: room.name, slug: room.slug }, roomToken: null });
  }

  const valid = await bcrypt.compare(password, room.passwordHash);
  if (!valid) return res.status(401).json({ error: "Kata sandi salah" });

  res.json({
    valid: true,
    room: { name: room.name, slug: room.slug },
    roomToken: signRoomToken(room.id),
  });
});

// Public: get recent messages for a room — protected rooms need the room access proof
router.get("/public/:slug/messages", async (req, res) => {
  const room = await prisma.room.findUnique({ where: { slug: req.params.slug } });
  if (!room) return res.status(404).json({ error: "Room tidak ditemukan" });

  if (room.passwordHash && !verifyRoomToken(req.get("X-Room-Token"), room.id)) {
    return res.status(403).json({ error: "Room ini memerlukan kata sandi" });
  }

  const messages = await prisma.message.findMany({
    where: { roomId: room.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, content: true, nickname: true, createdAt: true },
  });

  res.json({ messages: messages.reverse() });
});

module.exports = router;
