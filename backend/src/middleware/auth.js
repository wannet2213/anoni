const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function authenticateAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(header.split(" ")[1], JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = { signToken, authenticateAdmin };
