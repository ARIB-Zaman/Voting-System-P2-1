require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { toNodeHandler } = require("better-auth/node");
const { auth } = require("./auth");

const app = express();
const portNum = 3001;

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow the Vite dev server (and any origin during local dev)
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        credentials: true, // required for BetterAuth session cookies
    })
);

// ── BetterAuth handler ────────────────────────────────────────────────────────
// Must come BEFORE express.json() — BetterAuth parses its own body
app.all("/api/auth/{*splat}", toNodeHandler(auth.handler));

// ── Body parser (for all other routes) ───────────────────────────────────────
app.use(express.json());

// ── Existing routes ───────────────────────────────────────────────────────────
app.use("/api/election", require("./routes/adminHome"));
app.use("/api/users", require("./routes/users"));
app.use("/api/constituency", require("./routes/constituency"));

// ── New role-based routes ─────────────────────────────────────────────────────
app.use("/api/ro", require("./routes/ro"));
app.use("/api/po", require("./routes/po"));
app.use("/api/pro", require("./routes/pro"));

// ── Sign-up (public) & Admin approval ────────────────────────────────────────
app.use("/api/signup", require("./routes/signup"));
app.use("/api/admin", require("./routes/admin"));

app.listen(portNum, () => {
    console.log(`Backend running on http://localhost:${portNum}`);
});
