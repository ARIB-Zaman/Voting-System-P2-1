const express = require("express");
const router = express.Router();
const pool = require("../db");

// POST / — bulk-insert constituencies into an election
router.post("/", async (req, res) => {
  try {
    const { election_id, constituency_ids } = req.body;

    if (!election_id || !Array.isArray(constituency_ids)) {
      return res.status(400).json({
        error: "election_id and constituency_ids are required"
      });
    }

    const values = constituency_ids.map((cid) => [election_id, cid]);

    const query = `
      INSERT INTO constituency_of_election (election_id, constituency_id)
      VALUES ($1, $2)
    `;

    for (const val of values) {
      await pool.query(query, val);
    }

    res.json({
      message: "Constituencies added to election",
      inserted: constituency_ids.length
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /election/:electionId — constituencies for an election with assigned RO
router.get("/election/:electionId", async (req, res) => {
  try {
    const { electionId } = req.params;

    const result = await pool.query(
      `SELECT
         coe.id            AS coe_id,
         coe.constituency_id,
         c.name,
         c.region,
         rm.user_id        AS ro_id,
         u.name            AS ro_name
       FROM constituency_of_election coe
       JOIN constituency c ON c.id = coe.constituency_id
       LEFT JOIN role_map rm
         ON rm.relation_id = coe.id AND rm.role = 'RO'
       LEFT JOIN public."user" u ON u.id = rm.user_id
       WHERE coe.election_id = $1
       ORDER BY c.name`,
      [electionId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /:coeId/ro — assign or unassign the RO for a constituency_of_election
router.put("/:coeId/ro", async (req, res) => {
  const { coeId } = req.params;
  const { ro_id } = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Look up the election_id for this coe row
    const coeResult = await client.query(
      "SELECT election_id FROM constituency_of_election WHERE id = $1",
      [coeId]
    );
    if (coeResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Constituency-of-election not found" });
    }
    const { election_id } = coeResult.rows[0];

    // Remove any existing RO assignment for this coe entry
    await client.query(
      "DELETE FROM role_map WHERE relation_id = $1 AND role = 'RO'",
      [coeId]
    );

    // If a new RO is being assigned, insert
    if (ro_id) {
      await client.query(
        `INSERT INTO role_map (election_id, role, user_id, relation_id)
         VALUES ($1, 'RO', $2, $3)`,
        [election_id, ro_id, coeId]
      );
    }

    await client.query("COMMIT");

    // Return the updated row (same shape as the GET)
    const updated = await pool.query(
      `SELECT
         coe.id            AS coe_id,
         coe.constituency_id,
         c.name,
         c.region,
         rm.user_id        AS ro_id,
         u.name            AS ro_name
       FROM constituency_of_election coe
       JOIN constituency c ON c.id = coe.constituency_id
       LEFT JOIN role_map rm
         ON rm.relation_id = coe.id AND rm.role = 'RO'
       LEFT JOIN public."user" u ON u.id = rm.user_id
       WHERE coe.id = $1`,
      [coeId]
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



// DELETE /:coeId — remove a constituency from this election
router.delete("/:coeId", async (req, res) => {
  const { coeId } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Remove any RO assignment for this coe entry first
    await client.query(
      "DELETE FROM role_map WHERE relation_id = $1 AND role = 'RO'",
      [coeId]
    );

    // Delete the constituency_of_election row
    const result = await client.query(
      "DELETE FROM constituency_of_election WHERE id = $1 RETURNING *",
      [coeId]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Constituency assignment not found" });
    }

    await client.query("COMMIT");
    res.json({ message: "Constituency removed from election", deleted: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

module.exports = router;