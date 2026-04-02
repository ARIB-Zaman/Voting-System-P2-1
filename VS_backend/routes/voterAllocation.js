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
  const { q = "", election_id, constituency_id, not_in_election, limit = "50" } = req.query;
  if (!election_id || !constituency_id) {
    return res.status(400).json({ error: "election_id and constituency_id are required" });
  }
  try {
    const search = `%${q}%`;
    let query;
    let params;

    if (not_in_election === 'true') {
      // MODE 1: Show voters in master list who are NOT yet in this election
      query = `
        SELECT v.nid, v.name, v.phone, v.voter_type
        FROM voter v
        WHERE v.constituency_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM voter_of_election voe 
            WHERE voe.nid = v.nid AND voe.election_id = $2::integer
          )
          AND (v.name ILIKE $3 OR v.phone ILIKE $3 OR v.nid::text ILIKE $3)
        ORDER BY v.name ASC
        LIMIT $4`;
    } else {
      // MODE 2: Show voters already in the election master list (voter_of_election)
      // but NOT yet assigned to any polling center (center_id IS NULL).
      query = `
        SELECT v.nid, v.name, v.phone, v.voter_type
        FROM voter v
        JOIN voter_of_election voe ON voe.nid = v.nid
        WHERE v.constituency_id = $1
          AND voe.election_id = $2::integer
          AND voe.center_id IS NULL
          AND (v.name ILIKE $3 OR v.phone ILIKE $3 OR v.nid::text ILIKE $3)
        ORDER BY v.name ASC
        LIMIT $4`;
    }

    params = [constituency_id, election_id, search, parseInt(limit)];
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/voter-allocation/manual
 * Manually assign selected voters (by NID) to a polling center.
 * Voters must already be in voter_of_election with center_id = NULL.
 * Body: { nids: string[], center_id, election_id }
 */
router.post("/manual", async (req, res) => {
  const { nids, center_id, election_id } = req.body;
  if (!Array.isArray(nids) || nids.length === 0 || !center_id || !election_id) {
    return res.status(400).json({ error: "nids (array), center_id, and election_id are required" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const now = new Date().toISOString();
    let allocated = 0;
    for (const nid of nids) {
      const result = await client.query(
        `UPDATE voter_of_election
         SET center_id = $1, assigned_at = $2
         WHERE nid = $3 AND election_id = $4::integer AND center_id IS NULL`,
        [center_id, now, nid, election_id]
      );
      if (result.rowCount > 0) allocated++;
    }
    await client.query("COMMIT");
    res.json({ allocated, message: `${allocated} voter(s) assigned to center` });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
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

    // Cast all params explicitly — pg sends JS values as text by default
    const centerIdInt = parseInt(center_id);
    const electionIdInt = parseInt(election_id);
    const countInt = parseInt(count);

    // Call the DB function to get closest unallocated voters
    const votersResult = await client.query(
      `SELECT nid FROM get_closest_unallocated_voters($1::integer, $2::integer, $3::integer)`,
      [centerIdInt, electionIdInt, countInt]
    );

    if (votersResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.json({ allocated: 0, message: "No unallocated voters found nearby" });
    }

    const now = new Date().toISOString();
    let allocated = 0;
    for (const row of votersResult.rows) {
      const updateResult = await client.query(
        `UPDATE voter_of_election
         SET center_id = $1::integer, assigned_by = $2, assigned_at = $3
         WHERE nid = $4
         AND election_id = $5::integer
         AND center_id IS NULL`,
        [centerIdInt, assigned_by ?? null, now, row.nid, electionIdInt]
      );
      if (updateResult.rowCount > 0) allocated++;
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

// (POST /manual was here, now replaced by /add below or moved)

/**
 * PUT /api/voter-allocation/center/:centerId/election/:electionId/unassign-all
 * Unassign all voters from a polling center (set center_id = NULL, booth_id = NULL),
 * keeping them in the election master list so they can be reassigned.
 */
router.put("/center/:centerId/election/:electionId/unassign-all", async (req, res) => {
  const { centerId, electionId } = req.params;
  try {
    const result = await pool.query(
      `UPDATE voter_of_election
       SET center_id = NULL, booth_id = NULL, assigned_at = NULL
       WHERE center_id = $1 AND election_id = $2`,
      [centerId, electionId]
    );
    res.json({ message: `Unassigned ${result.rowCount} voter(s) from center`, removed: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/voter-allocation/remove
 * Remove a voter from an election after checking if they have already voted.
 * Body: { nid, election_id }
 * NOTE: Must be registered BEFORE /:voeId so Express doesn't swallow it.
 */
router.delete("/remove", async (req, res) => {
  const { nid, election_id } = req.body;

  if (!nid || !election_id) {
    return res.status(400).json({ error: "nid and election_id are required" });
  }

  try {
    // 1. Find the voe record
    const voeResult = await pool.query(
      "SELECT id FROM voter_of_election WHERE nid = $1 AND election_id = $2",
      [nid, election_id]
    );

    if (voeResult.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const voeId = voeResult.rows[0].id;

    // 2. Block removal if voter has already initiated OTP
    const otpCheck = await pool.query(
      "SELECT otp_id FROM voter_otp WHERE voter_of_election_id = $1 LIMIT 1",
      [voeId]
    );

    if (otpCheck.rows.length > 0) {
      return res.status(400).json({
        error: "Cannot remove voter. They have already started the voting process (OTP generated). Please clear their activity first."
      });
    }

    // 3. Delete
    await pool.query("DELETE FROM voter_of_election WHERE id = $1", [voeId]);
    res.json({ message: "Voter removed from election" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /api/voter-allocation/:voeId/unassign
 * Unassign a single voter from their polling center (set center_id = NULL, booth_id = NULL),
 * keeping them in the election master list so they can be reassigned.
 */
router.put("/:voeId/unassign", async (req, res) => {
  const { voeId } = req.params;
  if (!/^\d+$/.test(voeId)) {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    const result = await pool.query(
      `UPDATE voter_of_election
       SET center_id = NULL, booth_id = NULL, assigned_at = NULL
       WHERE id = $1
       RETURNING id`,
      [voeId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Allocation not found" });
    }
    res.json({ message: "Voter unassigned from center" });
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
         v.email,
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
 * POST /api/voter-allocation/:voeId/generate-otp
 * Generate (or regenerate) an OTP for a voter.
 * Calls the DB function generate_voter_otp(voter_of_election_id) which
 * inserts/updates voter_otp and returns the generated OTP string.
 */
router.post("/:voeId/generate-otp", async (req, res) => {
  const { voeId } = req.params;
  try {
    const result = await pool.query(
      `SELECT generate_voter_otp($1) AS otp`,
      [voeId]
    );
    const otp = result.rows[0]?.otp;
    if (otp === null || otp === undefined) {
      return res.status(404).json({ error: "OTP generation request failed" });
    }
    res.json({ otp });
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

// ═══════════════════════════════════════════════════════════════
// ELECTION-LEVEL VOTER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/voter-allocation/election/:electionId
 * Voters already assigned to the election master list.
 */
router.get("/election/:electionId", async (req, res) => {
  const { electionId } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         voe.id,
         voe.nid,
         v.name,
         v.phone,
         v.voter_type,
         v.constituency_id,
         c.name AS constituency_name,
         voe.assigned_at
       FROM voter_of_election voe
       JOIN voter v ON v.nid = voe.nid
       LEFT JOIN constituency c ON c.id = v.constituency_id
       WHERE voe.election_id = $1
       ORDER BY v.name ASC`,
      [electionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/voter-allocation/add
 * Manually assign a single voter to an election.
 * Body: { nid, election_id }
 */
router.post("/add", async (req, res) => {
  const { nid, election_id } = req.body;
  if (!nid || !election_id) {
    return res.status(400).json({ error: "nid and election_id are required" });
  }
  try {
    // 🔥 Get a valid ADMIN user ID for assigned_by
    const adminResult = await pool.query('SELECT id FROM "user" WHERE role = \'ADMIN\' LIMIT 1');
    if (adminResult.rows.length === 0) {
      return res.status(500).json({ error: "No admin user found to perform assignment" });
    }
    const adminId = adminResult.rows[0].id;

    const result = await pool.query(
      `INSERT INTO voter_of_election (nid, election_id, assigned_by, assigned_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (nid, election_id) DO NOTHING
       RETURNING id`,
      [nid, election_id, adminId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Voter already assigned to this election" });
    }

    res.json({ message: "Voter assigned successfully", id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", detail: err.message });
  }
});

module.exports = router;

