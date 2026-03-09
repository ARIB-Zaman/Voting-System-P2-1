const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// Accessible by RO, PRO, and ADMIN
router.use(requireAuth, requireRole('RO', 'PRO', 'ADMIN'));

/**
 * GET /api/polling-center/:centerId
 * Returns center info + constituency + election details (for the page header).
 */
router.get('/:centerId', async (req, res) => {
    const { centerId } = req.params;
    try {
        const result = await pool.query(
            `SELECT pc.center_id, pc.name AS center_name, pc.address, pc.status AS center_status,
                    c.constituency_id, c.name AS constituency_name,
                    e.election_id, e.name AS election_name, e.start_date, e.end_date, e.status AS election_status
             FROM polling_center pc
             JOIN constituency c ON pc.constituency_id = c.constituency_id
             JOIN election e ON c.election_id = e.election_id
             WHERE pc.center_id = $1`,
            [centerId]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Polling center not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/polling-center/:centerId/booths
 * Returns booths grouped by booth_number with their assigned POs.
 * Null po_id rows represent "booth exists, no officer" placeholders.
 */
router.get('/:centerId/booths', async (req, res) => {
    const { centerId } = req.params;
    try {
        const result = await pool.query(
            `SELECT pb.booth_id, pb.booth_number, pb.po_id, u.name AS po_name
             FROM polling_booth pb
             LEFT JOIN public."user" u ON pb.po_id = u.id
             WHERE pb.center_id = $1
             ORDER BY pb.booth_number ASC, pb.booth_id ASC`,
            [centerId]
        );

        const boothsMap = new Map();
        for (const row of result.rows) {
            if (!boothsMap.has(row.booth_number)) {
                boothsMap.set(row.booth_number, {
                    booth_number: row.booth_number,
                    officers: [],
                    // track the placeholder row id so client doesn't need to know
                    _placeholder_id: null,
                });
            }
            const booth = boothsMap.get(row.booth_number);
            if (row.po_id) {
                booth.officers.push({
                    booth_id: row.booth_id,
                    po_id: row.po_id,
                    po_name: row.po_name,
                });
            } else {
                booth._placeholder_id = row.booth_id;
            }
        }

        // Strip the internal _placeholder_id before sending
        const booths = Array.from(boothsMap.values()).map(({ _placeholder_id: _, ...b }) => b);
        res.json(booths);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/polling-center/:centerId/booths
 * Creates a new booth. Inserts a placeholder row (po_id = NULL) so the booth persists.
 * Body: { booth_number }
 */
router.post('/:centerId/booths', async (req, res) => {
    const { centerId } = req.params;
    const { booth_number } = req.body;

    if (!booth_number)
        return res.status(400).json({ error: 'booth_number is required' });

    try {
        // Check if booth_number already exists for this center
        const exists = await pool.query(
            `SELECT 1 FROM polling_booth WHERE center_id = $1 AND booth_number = $2 LIMIT 1`,
            [centerId, booth_number]
        );
        if (exists.rows.length > 0)
            return res.status(400).json({ error: `Booth #${booth_number} already exists` });

        // Insert placeholder
        await pool.query(
            `INSERT INTO polling_booth (center_id, booth_number, po_id) VALUES ($1, $2, NULL)`,
            [centerId, booth_number]
        );
        res.status(201).json({ booth_number, officers: [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/polling-center/:centerId/booths/:boothNumber
 * Renames a booth (changes booth_number on all its rows).
 * Body: { new_booth_number }
 */
router.put('/:centerId/booths/:boothNumber', async (req, res) => {
    const { centerId, boothNumber } = req.params;
    const { new_booth_number } = req.body;

    if (!new_booth_number)
        return res.status(400).json({ error: 'new_booth_number is required' });

    try {
        // Ensure target number doesn't exist
        if (Number(new_booth_number) !== Number(boothNumber)) {
            const exists = await pool.query(
                `SELECT 1 FROM polling_booth WHERE center_id = $1 AND booth_number = $2 LIMIT 1`,
                [centerId, new_booth_number]
            );
            if (exists.rows.length > 0)
                return res.status(400).json({ error: `Booth #${new_booth_number} already exists` });
        }

        await pool.query(
            `UPDATE polling_booth SET booth_number = $1 WHERE center_id = $2 AND booth_number = $3`,
            [new_booth_number, centerId, boothNumber]
        );
        res.json({ booth_number: Number(new_booth_number) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/polling-center/:centerId/booths/:boothNumber/officers
 * Assigns a PO to a booth.
 * Body: { po_id }
 * If a null placeholder row exists for this booth, it is replaced.
 */
router.post('/:centerId/booths/:boothNumber/officers', async (req, res) => {
    const { centerId, boothNumber } = req.params;
    const { po_id } = req.body;

    if (!po_id)
        return res.status(400).json({ error: 'po_id is required' });

    try {
        // Check PO is not already assigned to this booth
        const dup = await pool.query(
            `SELECT 1 FROM polling_booth WHERE center_id = $1 AND booth_number = $2 AND po_id = $3`,
            [centerId, boothNumber, po_id]
        );
        if (dup.rows.length > 0)
            return res.status(400).json({ error: 'This officer is already assigned to this booth' });

        // Replace null placeholder if it exists, otherwise insert
        const placeholder = await pool.query(
            `SELECT booth_id FROM polling_booth WHERE center_id = $1 AND booth_number = $2 AND po_id IS NULL LIMIT 1`,
            [centerId, boothNumber]
        );

        let boothId;
        if (placeholder.rows.length > 0) {
            const upd = await pool.query(
                `UPDATE polling_booth SET po_id = $1 WHERE booth_id = $2 RETURNING booth_id`,
                [po_id, placeholder.rows[0].booth_id]
            );
            boothId = upd.rows[0].booth_id;
        } else {
            const ins = await pool.query(
                `INSERT INTO polling_booth (center_id, booth_number, po_id) VALUES ($1, $2, $3) RETURNING booth_id`,
                [centerId, boothNumber, po_id]
            );
            boothId = ins.rows[0].booth_id;
        }

        // Return with officer name
        const full = await pool.query(
            `SELECT pb.booth_id, pb.po_id, u.name AS po_name
             FROM polling_booth pb
             JOIN public."user" u ON pb.po_id = u.id
             WHERE pb.booth_id = $1`,
            [boothId]
        );
        res.status(201).json(full.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/polling-center/assignment/:boothId
 * Removes a specific officer assignment.
 * If it was the last real officer, a null placeholder is re-inserted to keep the booth.
 */
router.delete('/assignment/:boothId', async (req, res) => {
    const { boothId } = req.params;
    try {
        // Get the row to delete
        const row = await pool.query(
            `SELECT center_id, booth_number, po_id FROM polling_booth WHERE booth_id = $1`,
            [boothId]
        );
        if (row.rows.length === 0)
            return res.status(404).json({ error: 'Assignment not found' });

        const { center_id, booth_number } = row.rows[0];
        await pool.query(`DELETE FROM polling_booth WHERE booth_id = $1`, [boothId]);

        // Check if the booth still has any real officers
        const remaining = await pool.query(
            `SELECT COUNT(*) FROM polling_booth WHERE center_id = $1 AND booth_number = $2 AND po_id IS NOT NULL`,
            [center_id, booth_number]
        );
        if (parseInt(remaining.rows[0].count) === 0) {
            // Re-insert placeholder so booth survives
            await pool.query(
                `INSERT INTO polling_booth (center_id, booth_number, po_id) VALUES ($1, $2, NULL)`,
                [center_id, booth_number]
            );
        }

        res.json({ message: 'Officer removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/polling-center/:centerId/booths/:boothNumber
 * Deletes an entire booth (all rows for this booth_number).
 */
router.delete('/:centerId/booths/:boothNumber', async (req, res) => {
    const { centerId, boothNumber } = req.params;
    try {
        const result = await pool.query(
            `DELETE FROM polling_booth WHERE center_id = $1 AND booth_number = $2 RETURNING *`,
            [centerId, boothNumber]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Booth not found' });
        res.json({ message: `Booth #${boothNumber} deleted` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
