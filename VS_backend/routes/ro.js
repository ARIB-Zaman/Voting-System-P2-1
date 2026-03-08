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

/**
 * GET /api/ro/constituency/:cId
 * Returns constituency info + parent election info for the page header.
 */
router.get('/constituency/:cId', async (req, res) => {
    const { cId } = req.params;
    try {
        const result = await pool.query(
            `SELECT c.constituency_id, c.name AS constituency_name, c.region,
                    e.election_id, e.name AS election_name, e.start_date, e.end_date, e.status
             FROM constituency c
             JOIN election e ON c.election_id = e.election_id
             WHERE c.constituency_id = $1`,
            [cId]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Constituency not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/ro/constituency/:cId/polling-centers
 * Returns all polling centers in this constituency, with presiding officer name.
 */
router.get('/constituency/:cId/polling-centers', async (req, res) => {
    const { cId } = req.params;
    try {
        const result = await pool.query(
            `SELECT pc.center_id, pc.name, pc.address, pc.status, pc.constituency_id,
                    pc.presiding_officer_id, u.name AS presiding_officer_name
             FROM polling_center pc
             LEFT JOIN public."user" u ON pc.presiding_officer_id = u.id
             WHERE pc.constituency_id = $1
             ORDER BY pc.center_id ASC`,
            [cId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/ro/constituency/:cId/polling-centers
 * Creates a new polling center.
 * Body: { name, address, status?, presiding_officer_name? }
 * If presiding_officer_name is provided, looks up the user by name.
 */
router.post('/constituency/:cId/polling-centers', async (req, res) => {
    const { cId } = req.params;
    const { name, address, status, presiding_officer_name } = req.body;

    if (!name || !address)
        return res.status(400).json({ error: 'name and address are required' });

    try {
        // Resolve presiding officer
        let presiding_officer_id = null;
        if (presiding_officer_name && presiding_officer_name.trim()) {
            const uRes = await pool.query(
                `SELECT id FROM public."user" WHERE name = $1 LIMIT 1`,
                [presiding_officer_name.trim()]
            );
            if (uRes.rows.length === 0)
                return res.status(400).json({ error: `No user found with name "${presiding_officer_name.trim()}"` });
            presiding_officer_id = uRes.rows[0].id;
        }

        // Determine default status from election dates if not provided
        let resolvedStatus = status;
        if (!resolvedStatus) {
            const elecRes = await pool.query(
                `SELECT e.start_date, e.end_date FROM election e
                 JOIN constituency c ON c.election_id = e.election_id
                 WHERE c.constituency_id = $1`,
                [cId]
            );
            if (elecRes.rows.length > 0) {
                const now = new Date();
                const start = new Date(elecRes.rows[0].start_date);
                const end = new Date(elecRes.rows[0].end_date);
                resolvedStatus = (now >= start && now <= end) ? 'OPEN' : 'CLOSED';
            } else {
                resolvedStatus = 'CLOSED';
            }
        }

        const ins = await pool.query(
            `INSERT INTO polling_center (name, address, constituency_id, status, presiding_officer_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [name.trim(), address.trim(), cId, resolvedStatus, presiding_officer_id]
        );

        // Return with officer name joined
        const full = await pool.query(
            `SELECT pc.*, u.name AS presiding_officer_name
             FROM polling_center pc
             LEFT JOIN public."user" u ON pc.presiding_officer_id = u.id
             WHERE pc.center_id = $1`,
            [ins.rows[0].center_id]
        );
        res.status(201).json(full.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/ro/polling-centers/:id
 * Updates a polling center.
 * Body: { name?, address?, status?, presiding_officer_name? }
 */
router.put('/polling-centers/:id', async (req, res) => {
    const { id } = req.params;
    const { name, address, status, presiding_officer_name } = req.body;

    try {
        // Resolve presiding officer
        let presiding_officer_id = undefined; // undefined means "don't change"
        if (presiding_officer_name !== undefined) {
            if (presiding_officer_name === null || presiding_officer_name.trim() === '') {
                presiding_officer_id = null;
            } else {
                const uRes = await pool.query(
                    `SELECT id FROM public."user" WHERE name = $1 LIMIT 1`,
                    [presiding_officer_name.trim()]
                );
                if (uRes.rows.length === 0)
                    return res.status(400).json({ error: `No user found with name "${presiding_officer_name.trim()}"` });
                presiding_officer_id = uRes.rows[0].id;
            }
        }

        // Fetch current row to fill in unchanged values
        const cur = await pool.query(
            `SELECT * FROM polling_center WHERE center_id = $1`, [id]
        );
        if (cur.rows.length === 0)
            return res.status(404).json({ error: 'Polling center not found' });

        const existing = cur.rows[0];
        const finalPOId = presiding_officer_id !== undefined ? presiding_officer_id : existing.presiding_officer_id;

        const upd = await pool.query(
            `UPDATE polling_center
             SET name = COALESCE($1, name),
                 address = COALESCE($2, address),
                 status = COALESCE($3, status),
                 presiding_officer_id = $4
             WHERE center_id = $5
             RETURNING *`,
            [name?.trim() || null, address?.trim() || null, status || null, finalPOId, id]
        );

        const full = await pool.query(
            `SELECT pc.*, u.name AS presiding_officer_name
             FROM polling_center pc
             LEFT JOIN public."user" u ON pc.presiding_officer_id = u.id
             WHERE pc.center_id = $1`,
            [id]
        );
        res.json(full.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/ro/polling-centers/:id
 */
router.delete('/polling-centers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `DELETE FROM polling_center WHERE center_id = $1 RETURNING *`,
            [id]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Polling center not found' });
        res.json({ message: 'Polling center deleted', center: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
