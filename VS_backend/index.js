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
const pool = require('./db');
const { Readable } = require('stream');
const betterAuthHandler = toNodeHandler(auth.handler);

app.all("/api/auth/{*splat}", async (req, res, next) => {
    if (req.method === "POST" && req.path === "/api/auth/sign-in/email") {
        const buffers = [];
        for await (const chunk of req) {
            buffers.push(chunk);
        }
        const bodyBuffer = Buffer.concat(buffers);
        const bodyString = bodyBuffer.toString('utf-8');
        
        let email = null;
        try {
            const json = JSON.parse(bodyString);
            email = json.email;
        } catch(e) {}

        const ip_address = req.ip || req.connection.remoteAddress;

        // Recreate the stream for better-auth
        const mockReq = Readable.from(bodyBuffer);
        Object.assign(mockReq, {
            method: req.method,
            url: req.url,
            headers: req.headers,
            socket: req.socket,
            connection: req.connection
        });

        res.on("finish", async () => {
            try {
                let user_id = null;
                let role = null;
                if (email) {
                    const u = await pool.query('SELECT id, role FROM "user" WHERE email = $1', [email]);
                    if (u.rows.length > 0) {
                        user_id = u.rows[0].id;
                        role = u.rows[0].role;
                    }
                }
                const success_flag = res.statusCode >= 200 && res.statusCode < 300;
                await pool.query(
                    `INSERT INTO login_log (ip_address, user_id, role, success_flag) VALUES ($1, $2, $3, $4)`,
                    [ip_address, user_id, role, success_flag]
                );
            } catch (err) {
                console.error("Login tracking error:", err);
            }
        });

        return betterAuthHandler(mockReq, res);
    }

    return betterAuthHandler(req, res);
});

// ── Body parser (for all other routes) ───────────────────────────────────────
app.use(express.json());

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


// ── Sign-up (public) & Admin approval ────────────────────────────────────────
app.use("/api/signup", require("./routes/signup"));
app.use("/api/admin", require("./routes/admin"));

app.listen(portNum, () => {
    console.log(`Backend running on http://localhost:${portNum}`);
});
