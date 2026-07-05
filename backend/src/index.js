const express = require("express");
const http = require("http");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const roomRoutes = require("./routes/rooms");
const publicRoutes = require("./routes/public");
const setupSocket = require("./socket");
const app = express();

// ponytail: CORS for Next.js dev; in prod nginx handles this
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/rooms", roomRoutes);
app.use("/api/v1/rooms", publicRoutes);

// ponytail: serve Next.js static from backend in single-container mode
// In docker-compose, nginx routes to backend which proxies to Next dev or serves built assets

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const server = http.createServer(app);
const io = setupSocket(server);
app.set("io", io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
