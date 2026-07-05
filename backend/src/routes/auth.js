const { Router } = require("express");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { signToken } = require("../middleware/auth");

const prisma = new PrismaClient();
const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({ error: "Email, username, and password required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      const field = existing.email === email ? "Email" : "Username";
      return res.status(409).json({ error: `${field} already registered` });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, username, password: hash },
    });

    const token = signToken({ id: user.id });
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ error: "Login and password required" });
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: login }, { username: login }] },
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken({ id: user.id });
    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
