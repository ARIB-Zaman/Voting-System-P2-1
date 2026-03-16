const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /election/:electionId/center/:centerId
// Fetch all booths for this election + center, with their PO officers
router.get("/election/:electionId/center/:centerId", async (req, res) => {
  try {
    const { electionId, centerId } = req.params;

    // Get all booths
    const boothsResult = await pool.query(
      `SELECT id, booth_number
       FROM polling_booth
       WHERE election_id = $1 AND polling_center_id = $2
       ORDER BY booth_number`,
      [electionId, centerId]
    );

    // For each booth, get assigned POs from role_map
    const booths = [];
    for (const booth of boothsResult.rows) {
      const officersResult = await pool.query(
        `SELECT rm.id AS role_map_id, rm.user_id, u.name AS user_name
         FROM role_map rm
         JOIN public."user" u ON u.id = rm.user_id
         WHERE rm.relation_id = $1 AND rm.role = 'PO'
         ORDER BY u.name`,
        [booth.id]
      );
      booths.push({
        id: booth.id,
        booth_number: booth.booth_number,
        officers: officersResult.rows,
      });
    }

    res.json(booths);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST / — create a new booth
router.post("/", async (req, res) => {
  try {
    const { booth_number, polling_center_id, election_id } = req.body;

    if (!booth_number || !polling_center_id || !election_id) {
      return res.status(400).json({
        error: "booth_number, polling_center_id, and election_id are required",
      });
    }

    // Check for duplicate booth_number in the same center + election
    const exists = await pool.query(
      `SELECT 1 FROM polling_booth
       WHERE polling_center_id = $1 AND election_id = $2 AND booth_number = $3
       LIMIT 1`,
      [polling_center_id, election_id, booth_number]
    );
    if (exists.rows.length > 0) {
      return res
        .status(400)
        .json({ error: `Booth #${booth_number} already exists` });
    }

    const result = await pool.query(
      `INSERT INTO polling_booth (booth_number, polling_center_id, election_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [booth_number, polling_center_id, election_id]
    );

    res.status(201).json({
      id: result.rows[0].id,
      booth_number: result.rows[0].booth_number,
      officers: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /:boothId — rename a booth
router.put("/:boothId", async (req, res) => {
  const { boothId } = req.params;
  const { booth_number } = req.body;

  if (!booth_number) {
    return res.status(400).json({ error: "booth_number is required" });
  }

  try {
    // Check if this booth exists
    const current = await pool.query(
      "SELECT polling_center_id, election_id FROM polling_booth WHERE id = $1",
      [boothId]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: "Booth not found" });
    }

    const { polling_center_id, election_id } = current.rows[0];

    // Check for duplicate
    const dup = await pool.query(
      `SELECT 1 FROM polling_booth
       WHERE polling_center_id = $1 AND election_id = $2 AND booth_number = $3 AND id != $4
       LIMIT 1`,
      [polling_center_id, election_id, booth_number, boothId]
    );
    if (dup.rows.length > 0) {
      return res
        .status(400)
        .json({ error: `Booth #${booth_number} already exists` });
    }

    await pool.query(
      "UPDATE polling_booth SET booth_number = $1 WHERE id = $2",
      [booth_number, boothId]
    );

    res.json({ id: Number(boothId), booth_number: Number(booth_number) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /:boothId — delete a booth
router.delete("/:boothId", async (req, res) => {
  const { boothId } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Remove PO assignments first
    await client.query(
      "DELETE FROM role_map WHERE relation_id = $1 AND role = 'PO'",
      [boothId]
    );

    // Delete booth
    const result = await client.query(
      "DELETE FROM polling_booth WHERE id = $1 RETURNING *",
      [boothId]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Booth not found" });
    }

    await client.query("COMMIT");
    res.json({ message: "Booth deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// POST /:boothId/officer — assign a PO to a booth
router.post("/:boothId/officer", async (req, res) => {
  const { boothId } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    // Look up the election_id from the booth
    const booth = await pool.query(
      "SELECT election_id FROM polling_booth WHERE id = $1",
      [boothId]
    );
    if (booth.rows.length === 0) {
      return res.status(404).json({ error: "Booth not found" });
    }
    const { election_id } = booth.rows[0];

    // Check if this user is already assigned to this booth
    const dup = await pool.query(
      `SELECT 1 FROM role_map
       WHERE relation_id = $1 AND role = 'PO' AND user_id = $2
       LIMIT 1`,
      [boothId, user_id]
    );
    if (dup.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "This officer is already assigned to this booth" });
    }

    const result = await pool.query(
      `INSERT INTO role_map (election_id, role, user_id, relation_id)
       VALUES ($1, 'PO', $2, $3) RETURNING id`,
      [election_id, user_id, boothId]
    );

    // Return with user name
    const user = await pool.query(
      `SELECT name FROM public."user" WHERE id = $1`,
      [user_id]
    );

    res.status(201).json({
      role_map_id: result.rows[0].id,
      user_id,
      user_name: user.rows[0]?.name ?? "Unknown",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /officer/:roleMapId — remove a PO from a booth
router.delete("/officer/:roleMapId", async (req, res) => {
  const { roleMapId } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM role_map WHERE id = $1 AND role = 'PO' RETURNING *",
      [roleMapId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Officer assignment not found" });
    }

    res.json({ message: "Officer removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
