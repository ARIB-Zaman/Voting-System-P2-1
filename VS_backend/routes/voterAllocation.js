const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * GET /api/voter-allocation/center/:centerId/election/:electionId
 * Voters already allocated to a specific polling center for an election.
 */
router.get("/center/:centerId/election/:electionId", async (req, res) => {
  const { centerId, electionId } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         voe.id,
         voe.nid,
         v.name,
         v.phone,
         v.voter_type,
         voe.assigned_at,
         voe.booth_id
       FROM voter_of_election voe
       JOIN voter v ON v.nid = voe.nid
       WHERE voe.center_id = $1
         AND voe.election_id = $2
       ORDER BY v.name ASC`,
      [centerId, electionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/voter-allocation/search?q=&election_id=&constituency_id=&limit=50
 * Search unallocated voters in a constituency for manual selection.
 * "Unallocated" = not yet in voter_of_election for this election.
 */
router.get("/search", async (req, res) => {
  const { q = "", election_id, constituency_id, limit = "50" } = req.query;
  if (!election_id || !constituency_id) {
    return res.status(400).json({ error: "election_id and constituency_id are required" });
  }
  try {
    const search = `%${q}%`;
    const result = await pool.query(
      `SELECT v.nid, v.name, v.phone, v.voter_type
       FROM voter v
       WHERE v.constituency_id = $1
         AND (v.name ILIKE $2 OR v.phone ILIKE $2 OR v.nid::text ILIKE $2)
         AND v.nid NOT IN (
           SELECT nid FROM voter_of_election WHERE election_id = $3
         )
       ORDER BY v.name ASC
       LIMIT $4`,
      [constituency_id, search, election_id, parseInt(limit)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/voter-allocation/auto
 * Auto-allocate the closest N unallocated voters to a polling center
 * using the DB function get_closest_unallocated_voters(center_id, election_id, count).
 * Body: { center_id, election_id, count, assigned_by }
 */
router.post("/auto", async (req, res) => {
  const { center_id, election_id, count, assigned_by } = req.body;
  if (!center_id || !election_id || !count) {
    return res.status(400).json({ error: "center_id, election_id, and count are required" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Call the DB function to get closest unallocated voters
    const votersResult = await client.query(
      `SELECT nid FROM get_closest_unallocated_voters($1, $2, $3)`,
      [center_id, election_id, parseInt(count)]
    );

    if (votersResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.json({ allocated: 0, message: "No unallocated voters found nearby" });
    }

    const now = new Date().toISOString();
    let allocated = 0;
    for (const row of votersResult.rows) {
      await client.query(
        `INSERT INTO voter_of_election (nid, election_id, center_id, assigned_by, assigned_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (nid, election_id) DO NOTHING`,
        [row.nid, election_id, center_id, assigned_by ?? null, now]
      );
      allocated++;
    }

    await client.query("COMMIT");
    res.json({ allocated, message: `${allocated} voter(s) allocated` });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

/**
 * POST /api/voter-allocation/manual
 * Manually allocate a list of voters (by nid) to a polling center.
 * Body: { nids: string[], center_id, election_id, assigned_by }
 */
router.post("/manual", async (req, res) => {
  const { nids, center_id, election_id, assigned_by } = req.body;
  if (!Array.isArray(nids) || nids.length === 0 || !center_id || !election_id) {
    return res.status(400).json({ error: "nids[], center_id, and election_id are required" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const now = new Date().toISOString();
    let allocated = 0;
    for (const nid of nids) {
      const r = await client.query(
        `INSERT INTO voter_of_election (nid, election_id, center_id, assigned_by, assigned_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (nid, election_id) DO NOTHING
         RETURNING id`,
        [nid, election_id, center_id, assigned_by ?? null, now]
      );
      if (r.rows.length > 0) allocated++;
    }
    await client.query("COMMIT");
    res.json({ allocated, skipped: nids.length - allocated });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/voter-allocation/center/:centerId/election/:electionId
 * Remove all voters allocated to a specific polling center for an election.
 */
router.delete("/center/:centerId/election/:electionId", async (req, res) => {
  const { centerId, electionId } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM voter_of_election WHERE center_id = $1 AND election_id = $2 RETURNING id",
      [centerId, electionId]
    );
    res.json({ message: `Removed ${result.rowCount} voter(s)`, removed: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/voter-allocation/:voeId
 * Remove a single voter from a polling center.
 */
router.delete("/:voeId", async (req, res) => {
  const { voeId } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM voter_of_election WHERE id = $1 RETURNING id",
      [voeId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Allocation not found" });
    }
    res.json({ message: "Voter deallocated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════════
// BOOTH-LEVEL VOTER ALLOCATION (PRO Dashboard)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/voter-allocation/booth/:boothId/election/:electionId
 * Voters assigned to this specific booth (booth_id = boothId).
 */
router.get("/booth/:boothId/election/:electionId", async (req, res) => {
  const { boothId, electionId } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         voe.id,
         voe.nid,
         v.name,
         v.phone,
         v.voter_type,
         voe.center_id
       FROM voter_of_election voe
       JOIN voter v ON v.nid = voe.nid
       WHERE voe.booth_id = $1
         AND voe.election_id = $2
       ORDER BY v.name ASC`,
      [boothId, electionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/voter-allocation/center/:centerId/election/:electionId/unassigned-booths
 * Voters allocated to a center but NOT yet assigned to any booth (booth_id IS NULL).
 */
router.get("/center/:centerId/election/:electionId/unassigned-booths", async (req, res) => {
  const { centerId, electionId } = req.params;
  const { q = "", limit = "100" } = req.query;
  try {
    const search = `%${q}%`;
    const result = await pool.query(
      `SELECT
         voe.id,
         voe.nid,
         v.name,
         v.phone,
         v.voter_type
       FROM voter_of_election voe
       JOIN voter v ON v.nid = voe.nid
       WHERE voe.center_id = $1
         AND voe.election_id = $2
         AND voe.booth_id IS NULL
         AND ($3 = '%%' OR v.name ILIKE $3 OR v.nid::text ILIKE $3 OR v.phone ILIKE $3)
       ORDER BY v.name ASC
       LIMIT $4`,
      [centerId, electionId, search, parseInt(limit)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /api/voter-allocation/:voeId/booth
 * Assign (or unassign) a voter to a booth.
 * Body: { booth_id: number | null }
 */
router.put("/:voeId/booth", async (req, res) => {
  const { voeId } = req.params;
  const { booth_id } = req.body;
  try {
    const result = await pool.query(
      "UPDATE voter_of_election SET booth_id = $1 WHERE id = $2 RETURNING id, booth_id",
      [booth_id ?? null, voeId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Allocation not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/voter-allocation/center/:centerId/election/:electionId/distribute
 * Auto-distribute all unassigned voters (booth_id IS NULL) to booths
 * using the DB function distribute_unassigned_voters(center_id, election_id).
 */
router.post("/center/:centerId/election/:electionId/distribute", async (req, res) => {
  const { centerId, electionId } = req.params;
  try {
    const result = await pool.query(
      `SELECT distribute_unassigned_voters($1, $2) AS assigned_count`,
      [centerId, electionId]
    );
    const assignedCount = result.rows[0]?.assigned_count ?? 0;
    res.json({
      assigned: assignedCount,
      message: `${assignedCount} voter(s) distributed across booths`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

