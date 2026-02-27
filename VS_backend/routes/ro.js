const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All RO routes require authentication + RO role
router.use(requireAuth, requireRole('RO', 'ADMIN'));

/**
 * GET /api/ro/elections
 * Returns elections where this RO has at least one constituency assigned.
 * Each election includes a nested `constituencies` array with only this RO's constituencies.
 */
router.get('/elections', async (req, res) => {
    const roId = req.user.id;
    try {
        // Get all constituencies assigned to this RO with election info
        const result = await pool.query(
            `SELECT e.election_id, e.name AS election_name, e.status, e.start_date, e.end_date,
                    c.constituency_id, c.name AS constituency_name, c.region
             FROM constituency c
             JOIN election e ON c.election_id = e.election_id
             WHERE c.ro_id = $1
             ORDER BY e.start_date DESC, c.name ASC`,
            [roId]
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
 * Returns RO-specific summary: elections count, constituencies count, active-now count.
 */
router.get('/summary', async (req, res) => {
    const roId = req.user.id;
    try {
        // Total unique elections where RO is assigned
        const elecResult = await pool.query(
            `SELECT COUNT(DISTINCT c.election_id) AS total,
                    COUNT(DISTINCT CASE WHEN e.status = 'LIVE' THEN c.election_id END) AS live
             FROM constituency c
             JOIN election e ON c.election_id = e.election_id
             WHERE c.ro_id = $1`,
            [roId]
        );

        // Total constituencies assigned
        const constResult = await pool.query(
            `SELECT COUNT(*) AS total FROM constituency WHERE ro_id = $1`,
            [roId]
        );

        const stats = elecResult.rows[0];
        res.json({
            elections: parseInt(stats.total) || 0,
            constituencies: parseInt(constResult.rows[0].total) || 0,
            active_now: parseInt(stats.live) || 0,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
