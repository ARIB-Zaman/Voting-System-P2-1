const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All PO routes require authentication + PO role
router.use(requireAuth, requireRole('PO', 'ADMIN'));

/**
 * GET /api/po/station
 * Returns the polling station assigned to this PO.
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
 * GET /api/po/voters
 * Returns the voter list for this PO's station.
 * Stub until voter table is available.
 */
router.get('/voters', async (req, res) => {
    try {
        // Stub — replace with real query
        res.json([]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/po/summary
 * Returns summary stats for the PO dashboard.
 */
router.get('/summary', async (req, res) => {
    try {
        res.json({
            station: { name: 'Unassigned', location: 'N/A' },
            today_checkins: 0,
            total_voters: 0,
            votes_cast: 0,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
