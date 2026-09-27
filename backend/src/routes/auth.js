const crypto = require("crypto");
const { Router } = require("express");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { signToken, authenticateAdmin } = require("../middleware/auth");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../email");

const prisma = new PrismaClient();
const router = Router();

// Panjang verifier: 32 byte dalam base64url. Bentuknya diperiksa supaya data yang
// salah bentuk tidak menghasilkan akun yang tidak bisa dipakai.
const VERIFIER = /^[A-Za-z0-9_-]{43}$/;
// Bentuk bungkusan kunci ruang: "w1:" diikuti iv+ciphertext dalam base64url.
const BUNGKUSAN = /^w1:[A-Za-z0-9_-]{20,2000}$/;
const ITERASI_MIN = 100000;
const ITERASI_BAWAAN = 600000;

// Salt palsu untuk nama akun yang tidak ada. Dipakai supaya bentuk jawaban
// /kdf-params tidak membocorkan keberadaan sebuah akun.
function saltPalsu(login) {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET || "anoni")
    .update(`salt:${login}`)
    .digest("base64url")
    .slice(0, 22);
}

// POST /kdf-params — parameter turunan kunci untuk sebuah akun.
// mode "lama" berarti akun dibuat sebelum enkripsi akun aktif dan perlu diangkat sekali.
router.post("/kdf-params", async (req, res) => {
  try {
    const { login } = req.body || {};
    if (!login || typeof login !== "string") {
      return res.status(400).json({ error: "Email atau username wajib diisi" });
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: login }, { username: login }] },
      select: { kdfSalt: true, kdfIterations: true, recoveryHash: true },
    });

    if (!user || !user.kdfSalt) {
      return res.json({
        kdfSalt: saltPalsu(login),
        kdfIterations: ITERASI_BAWAAN,
        mode: user ? "lama" : "akun",
        hasRecovery: !!user?.recoveryHash,
      });
    }

    res.json({
      kdfSalt: user.kdfSalt,
      kdfIterations: user.kdfIterations || ITERASI_BAWAAN,
      mode: "akun",
      hasRecovery: !!user.recoveryHash,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

// POST /register — create user (unverified), send email
router.post("/register", async (req, res) => {
  try {
    const { email, username, authVerifier, recoveryVerifier, kdfSalt, kdfIterations } = req.body;
    if (!email || !username || !authVerifier || !recoveryVerifier || !kdfSalt) {
      return res.status(400).json({ error: "Email, username, dan kata sandi wajib diisi" });
    }
    // Kata sandi tidak pernah sampai ke server; yang diterima hanya turunannya. Karena itu
    // kekuatan kata sandi dijaga di perangkat (frontend/src/lib/accountCrypto.js), dan server
    // hanya memeriksa bentuk data yang diterimanya.
    if (typeof authVerifier !== "string" || typeof recoveryVerifier !== "string"
      || !VERIFIER.test(authVerifier) || !VERIFIER.test(recoveryVerifier)) {
      return res.status(400).json({ error: "Data kunci akun tidak dikenali" });
    }
    const iterasi = Number(kdfIterations);
    if (!Number.isInteger(iterasi) || iterasi < ITERASI_MIN) {
      return res.status(400).json({ error: "Jumlah iterasi kunci terlalu rendah" });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      const field = existing.email === email ? "Email" : "Username";
      return res.status(409).json({ error: `${field} sudah terdaftar` });
    }

    const hash = await bcrypt.hash(authVerifier, 10);
    const recoveryHash = await bcrypt.hash(recoveryVerifier, 10);
    const user = await prisma.user.create({
      data: { email, username, password: hash, recoveryHash, kdfSalt, kdfIterations: iterasi },
    });

    // Create verification token (1-hour expiry)
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.verificationToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail(email, token, req.get("X-Anoni-Frontend-Origin"));
    } catch (emailErr) {
      console.error("Failed to send verification email:", emailErr.message);
      // Don't expose email error to client — user can resend
    }

    res.status(201).json({
      message: "Akun dibuat. Cek email Anda untuk tautan verifikasi.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

// POST /login — only allows verified users
router.post("/login", async (req, res) => {
  try {
    const { login, authVerifier, password } = req.body || {};
    if (!login) {
      return res.status(400).json({ error: "Email/username dan kata sandi wajib diisi" });
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: login }, { username: login }] },
    });
    if (!user) return res.status(401).json({ error: "Email atau kata sandi salah" });

    let valid = false;
    let needsKdfUpgrade = false;

    if (user.kdfSalt) {
      // Jalur baru: yang dibandingkan adalah turunan kata sandi yang dihitung di perangkat.
      if (typeof authVerifier !== "string" || !VERIFIER.test(authVerifier)) {
        return res.status(400).json({ error: "Data masuk tidak lengkap" });
      }
      valid = await bcrypt.compare(authVerifier, user.password);
    } else {
      // Jalur lama untuk akun yang dibuat sebelum enkripsi akun aktif. Klien diminta
      // mengangkat akun ini satu kali setelah berhasil masuk.
      if (typeof password !== "string" || !password) {
        return res.status(400).json({ error: "Data masuk tidak lengkap" });
      }
      valid = await bcrypt.compare(password, user.password);
      needsKdfUpgrade = valid;
    }
    if (!valid) return res.status(401).json({ error: "Email atau kata sandi salah" });

    if (!user.verified) {
      return res.status(403).json({ error: "Email belum diverifikasi. Cek inbox atau kirim ulang verifikasi." });
    }

    const jwt = signToken({ id: user.id, v: user.tokenVersion });
    res.json({
      token: jwt,
      needsKdfUpgrade,
      hasRecovery: !!user.recoveryHash,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

// POST /verify-verifier — memastikan turunan kata sandi yang dihitung di perangkat cocok
// dengan akun yang sedang masuk. Dipakai saat membuka kunci ruang di browser baru, dan
// tetap tidak mengirim kata sandi ke server.
router.post("/verify-verifier", authenticateAdmin, async (req, res) => {
  try {
    const { authVerifier } = req.body || {};
    if (typeof authVerifier !== "string" || !VERIFIER.test(authVerifier)) {
      return res.status(400).json({ error: "Data tidak lengkap" });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { password: true, kdfSalt: true },
    });
    if (!user?.kdfSalt) {
      return res.status(409).json({ error: "Akun ini belum memakai enkripsi akun" });
    }
    const cocok = await bcrypt.compare(authVerifier, user.password);
    if (!cocok) return res.status(401).json({ error: "Kata sandi tidak cocok" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

// POST /kdf-upgrade — mengangkat akun lama sekali saja ke enkripsi akun.
// Dipanggil setelah login berhasil, memakai token sesi yang baru diperoleh.
router.post("/kdf-upgrade", authenticateAdmin, async (req, res) => {
  try {
    const { authVerifier, recoveryVerifier, kdfSalt, kdfIterations } = req.body || {};
    if (typeof authVerifier !== "string" || typeof recoveryVerifier !== "string"
      || !VERIFIER.test(authVerifier) || !VERIFIER.test(recoveryVerifier)
      || typeof kdfSalt !== "string" || !kdfSalt) {
      return res.status(400).json({ error: "Data kunci akun tidak dikenali" });
    }
    const iterasi = Number(kdfIterations);
    if (!Number.isInteger(iterasi) || iterasi < ITERASI_MIN) {
      return res.status(400).json({ error: "Jumlah iterasi kunci terlalu rendah" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { kdfSalt: true },
    });
    if (user?.kdfSalt) {
      return res.status(409).json({ error: "Akun ini sudah memakai enkripsi akun" });
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        password: await bcrypt.hash(authVerifier, 10),
        recoveryHash: await bcrypt.hash(recoveryVerifier, 10),
        kdfSalt,
        kdfIterations: iterasi,
      },
    });

    res.json({ message: "Enkripsi akun aktif. Simpan kode pemulihan Anda." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

// POST /recovery-blobs — mengambil bungkusan kunci agar bisa dibungkus ulang saat kata
// sandi diganti. Verifikasinya memakai verifier kode pemulihan; tanpa kode pemulihannya
// sendiri, isi bungkusan tetap tidak bisa dibuka.
router.post("/recovery-blobs", async (req, res) => {
  try {
    const { login, recoveryVerifier } = req.body || {};
    if (!login || typeof recoveryVerifier !== "string" || !VERIFIER.test(recoveryVerifier)) {
      return res.status(400).json({ error: "Data tidak lengkap" });
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: login }, { username: login }] },
      select: {
        id: true,
        recoveryHash: true,
        rooms: { select: { slug: true, key: { select: { wrappedRecovery: true } } } },
      },
    });

    if (!user || !user.recoveryHash) {
      return res.status(401).json({ error: "Kode pemulihan tidak cocok" });
    }
    const cocok = await bcrypt.compare(recoveryVerifier, user.recoveryHash);
    if (!cocok) return res.status(401).json({ error: "Kode pemulihan tidak cocok" });

    res.json({
      blobs: user.rooms
        .filter((r) => r.key)
        .map((r) => ({ slug: r.slug, wrappedRecovery: r.key.wrappedRecovery })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

// GET /verify — verify email token
router.get("/verify", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Token verifikasi tidak ada di tautan" });

    const vt = await prisma.verificationToken.findUnique({ where: { token } });
    if (!vt) return res.status(404).json({ error: "Tautan verifikasi tidak valid atau sudah dipakai" });

    if (vt.expiresAt < new Date()) {
      await prisma.verificationToken.delete({ where: { id: vt.id } });
      return res.status(410).json({ error: "Tautan verifikasi sudah kedaluwarsa. Silakan daftar ulang." });
    }

    // Mark user verified + clean up token
    await prisma.user.update({ where: { id: vt.userId }, data: { verified: true } });
    await prisma.verificationToken.delete({ where: { id: vt.id } });

    res.json({ message: "Email terverifikasi. Anda sudah bisa login." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

// POST /resend-verification — resend verification email
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email wajib diisi" });

    const user = await prisma.user.findUnique({ where: { email } });

    // ponytail: same uniform answer as forgot-password — an anonymous caller must not learn whether
    // an address exists or is already verified, and must not be able to invalidate a pending link.
    const generic = { message: "Jika akun itu masih perlu verifikasi, email sudah dikirim." };
    if (!user || user.verified) return res.json(generic);

    const existing = await prisma.verificationToken.findFirst({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    const token = existing ? existing.token : crypto.randomBytes(32).toString("hex");
    if (!existing) {
      await prisma.verificationToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
    }

    try {
      await sendVerificationEmail(email, token, req.get("X-Anoni-Frontend-Origin"));
    } catch (emailErr) {
      console.error("Failed to resend verification email:", emailErr.message);
    }

    res.json(generic);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

// POST /forgot-password — generate reset token + send email
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email wajib diisi" });

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: "Jika akun itu terdaftar, tautan reset sudah dikirim." });
    }

    // Delete old reset tokens
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    // Create new token (15-minute expiry)
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 900000), // 15 minutes
      },
    });

    try {
      await sendPasswordResetEmail(email, token, req.get("X-Anoni-Frontend-Origin"));
    } catch (emailErr) {
      console.error("Failed to send password reset email:", emailErr.message);
    }

    res.json({ message: "Jika akun itu terdaftar, tautan reset sudah dikirim." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

// POST /reset-password — validasi token email, lalu perbarui kata sandi.
//
// Untuk akun yang sudah memakai enkripsi akun, kata sandi baru hanya bisa dipasang oleh
// pemegang kode pemulihan. Kode itu juga yang dipakai membuka bungkusan kunci lama di
// perangkat, supaya bisa dibungkus ulang dengan kata sandi baru. Tanpa kode pemulihan,
// riwayat ruang tidak bisa dibuka lagi, dan itu memang konsekuensinya.
router.post("/reset-password", async (req, res) => {
  try {
    const { token, authVerifier, recoveryVerifier, kdfSalt, kdfIterations, password, rewrapped } = req.body || {};
    if (!token) {
      return res.status(400).json({ error: "Token dan kata sandi wajib diisi" });
    }

    const rt = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!rt) return res.status(404).json({ error: "Tautan verifikasi tidak valid atau sudah dipakai" });

    if (rt.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: rt.id } });
      return res.status(410).json({ error: "Tautan reset sudah kedaluwarsa. Minta tautan baru." });
    }

    const user = await prisma.user.findUnique({
      where: { id: rt.userId },
      select: { recoveryHash: true },
    });

    let data;
    if (user?.recoveryHash) {
      // Akun berenkripsi: kode pemulihan wajib, dan kata sandi baru dikirim sebagai turunan.
      if (typeof recoveryVerifier !== "string" || !VERIFIER.test(recoveryVerifier)
        || typeof authVerifier !== "string" || !VERIFIER.test(authVerifier)) {
        return res.status(400).json({ error: "Kode pemulihan dan kata sandi baru wajib diisi" });
      }
      const cocok = await bcrypt.compare(recoveryVerifier, user.recoveryHash);
      if (!cocok) return res.status(401).json({ error: "Kode pemulihan tidak cocok" });

      const iterasi = Number(kdfIterations);
      if (!Number.isInteger(iterasi) || iterasi < ITERASI_MIN || typeof kdfSalt !== "string" || !kdfSalt) {
        return res.status(400).json({ error: "Parameter kunci akun tidak lengkap" });
      }

      data = {
        password: await bcrypt.hash(authVerifier, 10),
        kdfSalt,
        kdfIterations: iterasi,
        tokenVersion: { increment: 1 },
      };
    } else {
      // Akun lama: jalur lama tetap berlaku sampai akun itu diangkat.
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ error: "Kata sandi minimal 6 karakter" });
      }
      data = { password: await bcrypt.hash(password, 10), tokenVersion: { increment: 1 } };
    }

    await prisma.user.update({ where: { id: rt.userId }, data });

    // Bungkusan kunci yang dikirim klien sudah memakai kata sandi baru.
    if (Array.isArray(rewrapped) && rewrapped.length) {
      for (const item of rewrapped) {
        if (typeof item?.slug !== "string" || typeof item?.wrappedPassword !== "string") continue;
        if (!BUNGKUSAN.test(item.wrappedPassword)) continue;
        const room = await prisma.room.findFirst({
          where: { slug: item.slug, userId: rt.userId },
          select: { id: true },
        });
        if (!room) continue;
        await prisma.roomKey
          .update({ where: { roomId: room.id }, data: { wrappedPassword: item.wrappedPassword } })
          .catch(() => {});
      }
    }

    // Clean up token
    await prisma.passwordResetToken.delete({ where: { id: rt.id } });

    res.json({ message: "Kata sandi sudah diperbarui. Anda sudah bisa login." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

// DELETE /cleanup-expired — remove unverified users older than 24h (for cron)
// ponytail: requires CLEANUP_TOKEN from the environment; fails closed when it is unset.
function cleanupAuthorized(req) {
  const expected = process.env.CLEANUP_TOKEN;
  if (!expected) return false;
  const given = req.get("X-Cleanup-Token") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.delete("/cleanup-expired", async (req, res) => {
  try {
    if (!cleanupAuthorized(req)) {
      return res.status(401).json({ error: "Tidak diizinkan" });
    }
    const cutoff = new Date(Date.now() - 86400000); // 24 hours ago

    // Find all unverified users created before cutoff
    const expiredUsers = await prisma.user.findMany({
      where: {
        verified: false,
        createdAt: { lt: cutoff },
      },
      select: { id: true, email: true },
    });

    if (expiredUsers.length === 0) {
      return res.json({ deleted: 0, message: "Tidak ada akun belum terverifikasi yang kedaluwarsa." });
    }

    // Delete them (cascade will clean up tokens)
    const ids = expiredUsers.map((u) => u.id);
    await prisma.user.deleteMany({ where: { id: { in: ids } } });

    res.json({
      deleted: expiredUsers.length,
      message: `${expiredUsers.length} akun belum terverifikasi yang kedaluwarsa dihapus.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

module.exports = router;
