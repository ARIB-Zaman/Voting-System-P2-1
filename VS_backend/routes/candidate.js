const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * GET /api/candidate/coe/:coeId
 * All candidates for a constituency_of_election
 */
router.get("/coe/:coeId", async (req, res) => {
  const { coeId } = req.params;
  try {
    const result = await pool.query(
      `SELECT candidate_id, name, party, nomination_status
       FROM candidate
       WHERE constituency_of_election_id = $1
       ORDER BY name ASC`,
      [coeId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/candidate
 * Add a new candidate — nomination_status defaults to PENDING
 */
router.post("/", async (req, res) => {
  const { name, party, constituency_of_election_id } = req.body;
  if (!name || !party || !constituency_of_election_id) {
    return res.status(400).json({ error: "name, party, and constituency_of_election_id are required" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO candidate (name, party, nomination_status, constituency_of_election_id)
       VALUES ($1, $2, 'PENDING', $3)
       RETURNING candidate_id, name, party, nomination_status`,
      [name, party, constituency_of_election_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /api/candidate/:id/status
 * Update nomination_status — APPROVED or REJECTED
 */
router.put("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { nomination_status } = req.body;
  if (!["APPROVED", "REJECTED", "PENDING"].includes(nomination_status)) {
    return res.status(400).json({ error: "nomination_status must be APPROVED, REJECTED, or PENDING" });
  }
  try {
    const result = await pool.query(
      `UPDATE candidate
       SET nomination_status = $1
       WHERE candidate_id = $2
       RETURNING candidate_id, name, party, nomination_status`,
      [nomination_status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/candidate/:id
 * Remove a candidate
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM candidate WHERE candidate_id = $1 RETURNING candidate_id",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    res.json({ message: "Candidate removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/candidate/voter-count/:coeId
 * Total allocated voters across all polling centers for this constituency_of_election.
 * Uses voter_of_election joined via polling_center_of_election → polling_center.
 */
router.get("/voter-count/:coeId", async (req, res) => {
  const { coeId } = req.params;
  try {
    // Get constituency_id and election_id from coe row
    const coeResult = await pool.query(
      `SELECT election_id, constituency_id FROM constituency_of_election WHERE id = $1`,
      [coeId]
    );
    if (coeResult.rows.length === 0) {
      return res.status(404).json({ error: "COE not found" });
    }
    const { election_id, constituency_id } = coeResult.rows[0];

    // Sum voters assigned to polling centers in this constituency for this election
    const countResult = await pool.query(
      `SELECT COUNT(voe.id)::int AS total_voters
       FROM voter_of_election voe
       JOIN polling_center pc ON pc.id = voe.center_id
       WHERE voe.election_id = $1
         AND pc.constituency_id = $2`,
      [election_id, constituency_id]
    );
    res.json({ total_voters: countResult.rows[0].total_voters ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/candidate/center-voter-counts/:coeId
 * Per-center voter count for all centers in this constituency_of_election.
 * Returns [{ poe_id, polling_center_id, name, voter_count }]
 */
router.get("/center-voter-counts/:coeId", async (req, res) => {
  const { coeId } = req.params;
  try {
    const coeResult = await pool.query(
      `SELECT election_id, constituency_id FROM constituency_of_election WHERE id = $1`,
      [coeId]
    );
    if (coeResult.rows.length === 0) {
      return res.status(404).json({ error: "COE not found" });
    }
    const { election_id, constituency_id } = coeResult.rows[0];

    const result = await pool.query(
      `SELECT
         poe.id AS poe_id,
         poe.polling_center_id,
         pc.name,
         COUNT(voe.id)::int AS voter_count
       FROM polling_center_of_election poe
       JOIN polling_center pc ON pc.id = poe.polling_center_id
       LEFT JOIN voter_of_election voe
         ON voe.center_id = poe.polling_center_id AND voe.election_id = poe.election_id
       WHERE poe.election_id = $1
         AND pc.constituency_id = $2
       GROUP BY poe.id, poe.polling_center_id, pc.name
       ORDER BY pc.name`,
      [election_id, constituency_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
