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
// GET unassigned polling centers for a constituency in a specific election
router.get("/:constituencyId/polling_centers/unassigned/:electionId", async (req, res) => {
  try {
    const { constituencyId, electionId } = req.params;
    const result = await pool.query(
      `SELECT id, name, address FROM polling_center
       WHERE constituency_id = $1
         AND id NOT IN (
           SELECT polling_center_id FROM polling_center_of_election WHERE election_id = $2
         )
       ORDER BY name`,
      [constituencyId, electionId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;