const { Router } = require("express");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = Router();

// Public: get room info (for join page)
router.get("/public/:slug", async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { slug: req.params.slug },
    select: { id: true, name: true, slug: true, passwordHash: true },
  });
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json({ room: { id: room.id, name: room.name, slug: room.slug, protected: !!room.passwordHash } });
});

// Public: verify room password
router.post("/public/:slug/verify", async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password required" });

  const room = await prisma.room.findUnique({ where: { slug: req.params.slug } });
  if (!room) return res.status(404).json({ error: "Room not found" });

  const valid = await bcrypt.compare(password, room.passwordHash || "");
  if (!valid) return res.status(401).json({ error: "Invalid password" });

  res.json({ valid: true, room: { name: room.name, slug: room.slug } });
});

// Public: get recent messages for a room (after joining)
router.get("/public/:slug/messages", async (req, res) => {
  const room = await prisma.room.findUnique({ where: { slug: req.params.slug } });
  if (!room) return res.status(404).json({ error: "Room not found" });

  const messages = await prisma.message.findMany({
    where: { roomId: room.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, content: true, nickname: true, createdAt: true },
  });

  res.json({ messages: messages.reverse() });
});

module.exports = router;
