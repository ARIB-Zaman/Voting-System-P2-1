const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /election/:electionId/constituency/:constituencyId
// Polling centers assigned to this election for a specific constituency, with PRO info
router.get("/election/:electionId/constituency/:constituencyId", async (req, res) => {
  try {
    const { electionId, constituencyId } = req.params;

    const result = await pool.query(
      `SELECT
         poe.id            AS poe_id,
         poe.polling_center_id,
         pc.name,
         pc.address,
         rm.user_id        AS pro_id,
         u.name            AS pro_name
       FROM polling_center_of_election poe
       JOIN polling_center pc ON pc.id = poe.polling_center_id
       LEFT JOIN role_map rm
         ON rm.relation_id = poe.id AND rm.role = 'PRO'
       LEFT JOIN public."user" u ON u.id = rm.user_id
       WHERE poe.election_id = $1
         AND pc.constituency_id = $2
       ORDER BY pc.name`,
      [electionId, constituencyId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST / — bulk-insert polling centers into an election
router.post("/", async (req, res) => {
  try {
    const { election_id, polling_center_ids } = req.body;

    if (!election_id || !Array.isArray(polling_center_ids) || polling_center_ids.length === 0) {
      return res.status(400).json({
        error: "election_id and polling_center_ids are required"
      });
    }

    const query = `
      INSERT INTO polling_center_of_election (election_id, polling_center_id)
      VALUES ($1, $2)
    `;

    for (const pcId of polling_center_ids) {
      await pool.query(query, [election_id, pcId]);
    }

    res.json({
      message: "Polling centers added to election",
      inserted: polling_center_ids.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /:poeId — remove a polling center from this election
router.delete("/:poeId", async (req, res) => {
  const { poeId } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Remove any PRO assignment first
    await client.query(
      "DELETE FROM role_map WHERE relation_id = $1 AND role = 'PRO'",
      [poeId]
    );

    // Delete the polling_center_of_election row
    const result = await client.query(
      "DELETE FROM polling_center_of_election WHERE id = $1 RETURNING *",
      [poeId]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Polling center assignment not found" });
    }

    await client.query("COMMIT");
    res.json({ message: "Polling center removed from election", deleted: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// PUT /:poeId/pro — assign or unassign the PRO for a polling_center_of_election
router.put("/:poeId/pro", async (req, res) => {
  const { poeId } = req.params;
  const { pro_id } = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Look up the election_id for this poe row
    const poeResult = await client.query(
      "SELECT election_id FROM polling_center_of_election WHERE id = $1",
      [poeId]
    );
    if (poeResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Polling center assignment not found" });
    }
    const { election_id } = poeResult.rows[0];

    // Remove any existing PRO assignment for this poe entry
    await client.query(
      "DELETE FROM role_map WHERE relation_id = $1 AND role = 'PRO'",
      [poeId]
    );

    // If a new PRO is being assigned, insert
    if (pro_id) {
      await client.query(
        `INSERT INTO role_map (election_id, role, user_id, relation_id)
         VALUES ($1, 'PRO', $2, $3)`,
        [election_id, pro_id, poeId]
      );
    }

    await client.query("COMMIT");

    // Return the updated row (same shape as the GET)
    const updated = await pool.query(
      `SELECT
         poe.id            AS poe_id,
         poe.polling_center_id,
         pc.name,
         pc.address,
         rm.user_id        AS pro_id,
         u.name            AS pro_name
       FROM polling_center_of_election poe
       JOIN polling_center pc ON pc.id = poe.polling_center_id
       LEFT JOIN role_map rm
         ON rm.relation_id = poe.id AND rm.role = 'PRO'
       LEFT JOIN public."user" u ON u.id = rm.user_id
       WHERE poe.id = $1`,
      [poeId]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

module.exports = router;
