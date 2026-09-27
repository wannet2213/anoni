const express = require("express");
const http = require("http");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const roomRoutes = require("./routes/rooms");
const publicRoutes = require("./routes/public");
const keysRoutes = require("./routes/keys");
const setupSocket = require("./socket");
const app = express();

// CORS: the trusted origin comes from the same proxy-derived value the account emails use
// (nginx map $host -> X-Anoni-Frontend-Origin), so changing the public domain needs no redeploy.
// FRONTEND_URL stays the fallback for local development.
app.use((req, res, next) => {
  const trustedOrigin = req.get("X-Anoni-Frontend-Origin") || process.env.FRONTEND_URL || "http://localhost:3000";
  cors({ origin: trustedOrigin })(req, res, next);
});
app.use(express.json());

app.use("/api/v1/auth", authRoutes);
// Kunci ruang tersimpan dalam bentuk terbungkus; server tidak memegang kuncinya.
app.use("/api/v1/keys", keysRoutes);
// ponytail: public first. The admin router runs router.use(authenticateAdmin) for every path it
// receives, so mounting it first made /api/v1/rooms/public/* unreachable without a JWT.
app.use("/api/v1/rooms", publicRoutes);
app.use("/api/v1/rooms", roomRoutes);

// ponytail: serve Next.js static from backend in single-container mode
// In docker-compose, nginx routes to backend which proxies to Next dev or serves built assets

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ponytail: last-resort boundary. Express 4 does not catch rejections from async handlers, and an
// unhandled rejection is fatal on modern Node — log it instead of losing the whole process.
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err && err.message ? err.message : err);
});

const server = http.createServer(app);
const io = setupSocket(server);
app.set("io", io);

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "127.0.0.1";
server.listen(PORT, HOST, () => {
  console.log(`Server running on port ${PORT}`);
});
