const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

/**
 * GET /api/analytics/voter-heatmap/:electionId
 *
 * Returns two arrays for the geospatial heatmap:
 *   voterPoints   — [lat, lng] pairs for every voter allocated to this election
 *   centerPoints  — { id, name, lat, lng, currentVoterCount } for every polling
 *                   center serving the constituencies in this election
 *
 * Performance notes:
 *   • Only lat/lng is fetched for voters (no names, NIDs, or other fields).
 *   • Both queries use indexed FK joins so they scale to tens of thousands of rows.
 */
router.get(
  "/voter-heatmap/:electionId",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const { electionId } = req.params;
    const electionIdInt = parseInt(electionId, 10);

    if (isNaN(electionIdInt)) {
      return res.status(400).json({ error: "Invalid electionId" });
    }

    try {
      // ── 1. Voter points ────────────────────────────────────────────────────
      // Join voter_of_election → voter to get coordinates of every voter
      // assigned to this election. Only fetch lat/lng (lightweight payload).
      const voterResult = await pool.query(
        `SELECT v.lat, v.lng
         FROM voter_of_election voe
         JOIN voter v ON v.nid = voe.nid
         WHERE voe.election_id = $1
           AND v.lat IS NOT NULL
           AND v.lng IS NOT NULL`,
        [electionIdInt]
      );

      // Shape: [[lat, lng], [lat, lng], ...]
      const voterPoints = voterResult.rows.map((r) => [
        parseFloat(r.lat),
        parseFloat(r.lng),
      ]);

      // ── 2. Center points ───────────────────────────────────────────────────
      // Find all constituencies linked to this election, then find all polling
      // centers for those constituencies (via polling_center_of_election).
      // Also count how many voters are currently assigned to each center.
      const centerResult = await pool.query(
        `SELECT
           pc.id,
           pc.name,
           pc.lat,
           pc.lng,
           COUNT(voe.id) FILTER (WHERE voe.election_id = $1) AS current_voter_count
         FROM polling_center_of_election pcoe
         JOIN polling_center pc ON pc.id = pcoe.polling_center_id
         JOIN constituency_of_election coe
           ON coe.constituency_id = pc.constituency_id
           AND coe.election_id = $1
         LEFT JOIN voter_of_election voe
           ON voe.center_id = pc.id
           AND voe.election_id = $1
         WHERE pcoe.election_id = $1
           AND pc.lat IS NOT NULL
           AND pc.lng IS NOT NULL
         GROUP BY pc.id, pc.name, pc.lat, pc.lng
         ORDER BY pc.name ASC`,
        [electionIdInt]
      );

      const centerPoints = centerResult.rows.map((r) => ({
        id: r.id,
        name: r.name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lng),
        currentVoterCount: parseInt(r.current_voter_count, 10) || 0,
      }));

      return res.json({ voterPoints, centerPoints });
    } catch (err) {
      console.error("Heatmap query error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

module.exports = router;
