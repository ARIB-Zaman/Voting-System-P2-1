require('dotenv').config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();
const portNum = 3001;

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        credentials: true, // required for JWT cookie
    })
);

// ── Cookie parser (read JWT from httpOnly cookie) ─────────────────────────────
app.use(cookieParser());

// ── Body parser ───────────────────────────────────────────────────────────────
app.use(express.json());

// ── Auth routes (login / logout / /me) ───────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));

// ── Existing routes ───────────────────────────────────────────────────────────
app.use("/api/election", require("./routes/adminHome"));
app.use("/api/users", require("./routes/users"));
app.use("/api/constituency", require("./routes/constituency"));
app.use("/api/constituency_of_election", require("./routes/constituency_of_election"));
app.use("/api/polling-center", require("./routes/pollingCenter"));
app.use("/api/polling_center_of_election", require("./routes/polling_center_of_election"));
app.use("/api/polling_booth", require("./routes/polling_booth"));
app.use("/api/candidate", require("./routes/candidate"));
app.use("/api/voter-allocation", require("./routes/voterAllocation"));
app.use("/api/voters", require("./routes/voters"));
app.use("/api/admin-polling-centers", require("./routes/adminPollingCenters"));
app.use("/api/kiosk", require("./routes/kiosk"));
app.use("/api/voter", require("./routes/voterDashboard"));
app.use("/api/voter-portal", require("./routes/voterPortal"));

// ── Sign-up (public) & Admin approval ────────────────────────────────────────
app.use("/api/signup", require("./routes/signup"));
app.use("/api/admin", require("./routes/admin"));

app.listen(portNum, () => {
    console.log(`Backend running on http://localhost:${portNum}`);
});
