const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All PRO routes require authentication + PRO role
router.use(requireAuth, requireRole('PRO', 'ADMIN'));

/**
 * GET /api/pro/elections
 * Returns elections where this PRO is the presiding officer of at least one
 * polling center, with the assigned centers nested under each election.
 */
router.get('/elections', async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(
            `SELECT e.election_id, e.name AS election_name, e.status,
                    e.start_date, e.end_date,
                    pc.center_id, pc.name AS center_name, pc.address, pc.status AS center_status,
                    c.constituency_id, c.name AS constituency_name
             FROM polling_center pc
             JOIN constituency c ON pc.constituency_id = c.constituency_id
             JOIN election e ON c.election_id = e.election_id
             WHERE pc.presiding_officer_id = $1
             ORDER BY e.start_date DESC, pc.center_id ASC`,
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
                    centers: [],
                });
            }
            electionsMap.get(row.election_id).centers.push({
                center_id: row.center_id,
                center_name: row.center_name,
                address: row.address,
                center_status: row.center_status,
                constituency_id: row.constituency_id,
                constituency_name: row.constituency_name,
            });
        }

        res.json(Array.from(electionsMap.values()));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
