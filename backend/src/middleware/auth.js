const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const JWT_SECRET = process.env.JWT_SECRET;
const prisma = new PrismaClient();

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

// ponytail: room access proof, not a session — just enough to bind "this client passed the room
// password" to later reads/writes on that room. Sliding 12h window, room id (not slug) so a deleted
// and recreated slug cannot be reused to inherit access.
function signRoomToken(roomId) {
  return jwt.sign({ room: roomId, kind: "room" }, JWT_SECRET, { expiresIn: "12h" });
}

function verifyRoomToken(token, roomId) {
  if (!token || !roomId) return false;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.kind === "room" && decoded.room === roomId;
  } catch {
    return false;
  }
}

async function authenticateAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Tidak diizinkan" });
  }
  try {
    const decoded = jwt.verify(header.split(" ")[1], JWT_SECRET);
    if (decoded.kind === "room") return res.status(401).json({ error: "Sesi tidak valid" });

    // ponytail: tokenVersion is bumped on password reset, so pre-reset tokens stop working.
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { tokenVersion: true },
    });
    if (!user || (decoded.v || 0) !== user.tokenVersion) {
      return res.status(401).json({ error: "Sesi tidak valid" });
    }
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "Sesi tidak valid" });
  }
}

module.exports = { signToken, signRoomToken, verifyRoomToken, authenticateAdmin };
