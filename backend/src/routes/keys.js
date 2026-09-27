const { Router } = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticateAdmin } = require("../middleware/auth");

const prisma = new PrismaClient();
const router = Router();

// Bentuk bungkusan kunci ruang: "w1:" diikuti iv+ciphertext dalam base64url.
const BUNGKUSAN = /^w1:[A-Za-z0-9_-]{20,2000}$/;
// Penanda untuk ruang yang belum dibungkus dengan kode pemulihan. Ruang seperti ini masih
// bisa dibuka dengan kata sandi akun, tetapi tidak bisa dipulihkan kalau kata sandi lupa.
const TANPA_PEMULIHAN = "none";

// GET /api/v1/keys — daftar bungkusan kunci untuk ruang milik akun ini.
// Isinya hanya berguna bagi pemegang kata sandi akun atau kode pemulihan.
router.get("/", authenticateAdmin, async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      where: { userId: req.userId },
      select: { slug: true, key: { select: { wrappedPassword: true, wrappedRecovery: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      keys: rooms
        .filter((r) => r.key)
        .map((r) => ({
          slug: r.slug,
          wrappedPassword: r.key.wrappedPassword,
          wrappedRecovery: r.key.wrappedRecovery,
        })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

// PUT /api/v1/keys/:slug — simpan atau perbarui bungkusan kunci ruang milik akun ini.
router.put("/:slug", authenticateAdmin, async (req, res) => {
  try {
    const { wrappedPassword, wrappedRecovery } = req.body || {};
    const pemulihanSah = wrappedRecovery === TANPA_PEMULIHAN || BUNGKUSAN.test(wrappedRecovery || "");
    if (!BUNGKUSAN.test(wrappedPassword || "") || !pemulihanSah) {
      return res.status(400).json({ error: "Bungkusan kunci tidak dikenali" });
    }

    const room = await prisma.room.findFirst({
      where: { slug: req.params.slug, userId: req.userId },
      select: { id: true },
    });
    if (!room) return res.status(404).json({ error: "Ruang tidak ditemukan" });

    await prisma.roomKey.upsert({
      where: { roomId: room.id },
      create: { roomId: room.id, wrappedPassword, wrappedRecovery },
      update: { wrappedPassword, wrappedRecovery },
    });

    res.json({ saved: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

module.exports = router;
