const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * GET /api/users
 * Get ALL users
 */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/users/ro
 * Get users with role = RO
 */
router.get("/ro", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM public.\"user\" WHERE role = $1 AND approved = true",
      ["RO"]
    );

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;