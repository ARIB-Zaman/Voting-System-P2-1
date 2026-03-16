const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET all constituencies
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM constituency ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all unassigned constituencies for a specific election
router.get("/unassigned/:electionId", async (req, res) => {
  try {
    const { electionId } = req.params;
    const result = await pool.query(
      `SELECT * FROM constituency
       WHERE id NOT IN (
         SELECT constituency_id FROM constituency_of_election WHERE election_id = $1
       )
       ORDER BY name`,
       [electionId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;