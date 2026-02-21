const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All RO routes require authentication + RO role
router.use(requireAuth, requireRole('RO', 'ADMIN'));

/**
 * GET /api/ro/elections
 * Returns elections relevant to this RO.
 * For now returns all elections — expand with assignment logic later.
 */
router.get('/elections', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM election ORDER BY start_date DESC'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/ro/stations
 * Returns polling stations under this RO.
 * Stub: returns empty array until polling_station table is available.
 */
router.get('/stations', async (req, res) => {
    try {
        // Stub — replace with real query once polling_station table exists
        res.json([]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/ro/summary
 * Returns summary stats for the RO dashboard.
 */
router.get('/summary', async (req, res) => {
    try {
        const electionsResult = await pool.query('SELECT status, COUNT(*) as count FROM election GROUP BY status');
        const stats = { total: 0, live: 0, planned: 0, closed: 0 };
        electionsResult.rows.forEach((row) => {
            const count = parseInt(row.count);
            stats.total += count;
            if (row.status === 'LIVE') stats.live = count;
            if (row.status === 'PLANNED') stats.planned = count;
            if (row.status === 'CLOSED' || row.status === 'FINALIZED') stats.closed += count;
        });
        res.json({ elections: stats, stations: 0, voters: 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
