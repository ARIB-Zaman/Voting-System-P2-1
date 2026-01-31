const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET all users
router.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM election");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST new user
router.post("/", async (req, res) => {
    const { name, email } = req.body;

    try {
        await pool.query(
            "INSERT INTO users (name, email) VALUES ($1, $2)",
            [name, email]   // prevents SQL injection
        );
        res.status(201).json({ message: "User added" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
