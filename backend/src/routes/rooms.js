const { Router } = require("express");
const bcrypt = require("bcryptjs");
const { customAlphabet } = require("nanoid");
const { PrismaClient } = require("@prisma/client");
const { authenticateAdmin } = require("../middleware/auth");

const prisma = new PrismaClient();
const router = Router();

// ponytail: nanoid for short unique slugs
const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

// ── Admin-protected routes ──

router.use(authenticateAdmin);

router.get("/", async (req, res) => {
  const rooms = await prisma.room.findMany({
    where: { userId: req.userId },
    select: {
      id: true, name: true, slug: true, passwordHash: true,
      createdAt: true, _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      protected: !!r.passwordHash,
      messageCount: r._count.messages,
      createdAt: r.createdAt,
    })),
  });
});

router.post("/", async (req, res) => {
  const { name, password, slug: customSlug } = req.body;
  if (!name) return res.status(400).json({ error: "Room name required" });

  const slug = customSlug || nanoid();
  const data = { name, slug, userId: req.userId };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  try {
    const room = await prisma.room.create({ data });
    res.status(201).json({
      room: {
        id: room.id, name: room.name, slug: room.slug,
        protected: !!room.passwordHash, createdAt: room.createdAt,
      },
    });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Slug already taken" });
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  const room = await prisma.room.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!room) return res.status(404).json({ error: "Room not found" });

  await prisma.room.delete({ where: { id: room.id } });

  // Broadcast room deletion via Socket.IO
  const io = req.app.get("io");
  if (io) io.to(room.slug).emit("room_deleted", { slug: room.slug });

  res.json({ deleted: true });
});

module.exports = router;
