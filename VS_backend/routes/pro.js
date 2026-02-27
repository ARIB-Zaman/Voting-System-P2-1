const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All PRO routes require authentication + PRO role
router.use(requireAuth, requireRole('PRO', 'ADMIN'));

/**
 * GET /api/pro/station
 * Returns the polling station assigned to this PRO.
 * Stub until polling_station table + assignment logic is ready.
 */
router.get('/station', async (req, res) => {
    try {
        // Stub — replace with real query
        res.json({
            station_id: null,
            name: 'Unassigned',
            location: 'N/A',
            capacity: 0,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/pro/officers
 * Returns the list of polling officers under this PRO.
 * Stub until assignment logic is ready.
 */
router.get('/officers', async (req, res) => {
    try {
        // Stub — replace with real query
        res.json([]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/pro/summary
 * Returns summary stats for the PRO dashboard.
 */
router.get('/summary', async (req, res) => {
    try {
        res.json({
            station: { name: 'Unassigned', location: 'N/A' },
            total_officers: 0,
            total_voters: 0,
            votes_cast: 0,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
