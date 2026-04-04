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


// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/analytics/vote-integrity/:electionId
 *
 * Returns a 4-stage funnel for the "Vote Erosion" security audit view:
 *
 *   Stage 1 – Allocated:       All rows in voter_of_election for this election.
 *   Stage 2 – Booth Assigned:  Voters who have both center_id AND booth_id set.
 *   Stage 3 – OTP Requested:   Distinct voter_of_election_id entries in voter_otp
 *                               (voter reached the kiosk, OTP was generated).
 *   Stage 4 – Vote Cast:       Rows in voting_log linked to this election via
 *                               constituency_of_election.
 *
 * Integrity alert: If the gap between OTP Requested → Vote Cast > 1%,
 * hasIntegrityAlert = true. This means someone passed security but their vote
 * was never recorded — a potential server/integrity issue.
 *
 * All 4 counts run in parallel via Promise.all for performance.
 * Access: ADMIN only.
 */
router.get(
  "/vote-integrity/:electionId",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const { electionId } = req.params;
    const electionIdInt = parseInt(electionId, 10);

    if (isNaN(electionIdInt)) {
      return res.status(400).json({ error: "Invalid electionId" });
    }

    try {
      const [allocatedRes, boothAssignedRes, otpRequestedRes, voteCastRes] =
        await Promise.all([
          // Stage 1 – Total allocated voters
          pool.query(
            `SELECT COUNT(*) AS count
             FROM voter_of_election
             WHERE election_id = $1`,
            [electionIdInt]
          ),

          // Stage 2 – Fully placed (center + booth assigned)
          pool.query(
            `SELECT COUNT(*) AS count
             FROM voter_of_election
             WHERE election_id = $1
               AND center_id IS NOT NULL
               AND booth_id IS NOT NULL`,
            [electionIdInt]
          ),

          // Stage 3 – OTP requested (distinct entries in voter_otp for this election)
          pool.query(
            `SELECT COUNT(DISTINCT vo.voter_of_election_id) AS count
             FROM voter_otp vo
             JOIN voter_of_election voe ON voe.id = vo.voter_of_election_id
             WHERE voe.election_id = $1`,
            [electionIdInt]
          ),

          // Stage 4 – Votes cast (voting_log joined to this election)
          pool.query(
            `SELECT COUNT(vl.voter_token) AS count
             FROM voting_log vl
             JOIN constituency_of_election coe
               ON coe.id = vl.constituency_of_election_id
             WHERE coe.election_id = $1`,
            [electionIdInt]
          ),
        ]);

      const allocated     = parseInt(allocatedRes.rows[0].count,     10) || 0;
      const boothAssigned = parseInt(boothAssignedRes.rows[0].count, 10) || 0;
      const otpRequested  = parseInt(otpRequestedRes.rows[0].count,  10) || 0;
      const voteCast      = parseInt(voteCastRes.rows[0].count,       10) || 0;

      // Retention % relative to the immediately preceding stage
      const pct = (value, base) =>
        base > 0 ? Math.round((value / base) * 1000) / 10 : 0;

      const funnel = [
        {
          stage:     "Allocated",
          label:     "Voters Allocated",
          value:     allocated,
          retention: 100,
          dropOff:   0,
          icon:      "users",
        },
        {
          stage:     "Booth Assigned",
          label:     "Booth Assigned",
          value:     boothAssigned,
          retention: pct(boothAssigned, allocated),
          dropOff:   allocated - boothAssigned,
          icon:      "building2",
        },
        {
          stage:     "OTP Requested",
          label:     "OTP Requested",
          value:     otpRequested,
          retention: pct(otpRequested, boothAssigned || allocated),
          dropOff:   (boothAssigned || allocated) - otpRequested,
          icon:      "key",
        },
        {
          stage:     "Vote Cast",
          label:     "Votes Cast",
          value:     voteCast,
          retention: pct(voteCast, otpRequested || boothAssigned || allocated),
          dropOff:   (otpRequested || boothAssigned || allocated) - voteCast,
          icon:      "check-circle",
        },
      ];

      // Integrity alert: OTP→Vote gap > 1%
      const otpBase          = otpRequested || boothAssigned || allocated;
      const integrityGapPct  = pct(otpBase - voteCast, otpBase);
      const hasIntegrityAlert = otpRequested > 0 && integrityGapPct > 1;

      return res.json({
        electionId: electionIdInt,
        funnel,
        meta: {
          integrityGapPct,
          hasIntegrityAlert,
          alertMessage: hasIntegrityAlert
            ? `⚠️ ${integrityGapPct}% of voters who requested an OTP did not have a vote recorded. Check server logs.`
            : null,
        },
      });
    } catch (err) {
      console.error("Vote integrity query error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

module.exports = router;
