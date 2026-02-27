const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All RO routes require authentication + RO role
router.use(requireAuth, requireRole('RO', 'ADMIN'));

/**
 * GET /api/ro/elections
 * Returns elections where this RO has ≥1 constituency assigned,
 * with the assigned constituencies nested.
 */
router.get('/elections', async (req, res) => {
    const userId = req.user.id;
    try {
        // Get all constituencies assigned to this RO, joined with election info
        const result = await pool.query(
            `SELECT e.election_id, e.name AS election_name, e.status, e.start_date, e.end_date,
                    c.constituency_id, c.name AS constituency_name, c.region
             FROM constituency c
             JOIN election e ON c.election_id = e.election_id
             WHERE c.ro_id = $1
             ORDER BY e.start_date DESC, c.name ASC`,
            [userId]
        );

        // Group by election
        const electionsMap = new Map();
        for (const row of result.rows) {
            if (!electionsMap.has(row.election_id)) {
                electionsMap.set(row.election_id, {
                    election_id: row.election_id,
                    name: row.election_name,
                    status: row.status,
                    start_date: row.start_date,
                    end_date: row.end_date,
                    constituencies: [],
                });
            }
            electionsMap.get(row.election_id).constituencies.push({
                constituency_id: row.constituency_id,
                name: row.constituency_name,
                region: row.region,
            });
        }

        res.json(Array.from(electionsMap.values()));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/ro/summary
 * Returns summary stats filtered by this RO's assignments.
 */
router.get('/summary', async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(
            `SELECT e.status, COUNT(DISTINCT e.election_id) AS election_count,
                    COUNT(c.constituency_id) AS constituency_count
             FROM constituency c
             JOIN election e ON c.election_id = e.election_id
             WHERE c.ro_id = $1
             GROUP BY e.status`,
            [userId]
        );

        let totalElections = 0;
        let liveElections = 0;
        let totalConstituencies = 0;

        for (const row of result.rows) {
            const ec = parseInt(row.election_count);
            const cc = parseInt(row.constituency_count);
            totalElections += ec;
            totalConstituencies += cc;
            if (row.status === 'LIVE') liveElections = ec;
        }

        res.json({
            elections: totalElections,
            constituencies: totalConstituencies,
            active_now: liveElections,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
