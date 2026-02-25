const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All admin routes require authentication + ADMIN role
router.use(requireAuth, requireRole('ADMIN'));

/**
 * GET /api/admin/pending
 * Returns all users where approved = false (pending sign-up requests).
 */
router.get('/pending', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, role, "createdAt"
             FROM "user"
             WHERE approved = false
             ORDER BY "createdAt" DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/approve/:userId
 * Sets approved = true for the given user.
 */
router.post('/approve/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(
            'UPDATE "user" SET approved = true WHERE id = $1 RETURNING id, name, email, role',
            [userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ message: 'User approved.', user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/reject/:userId
 * Deletes the user (reject = remove from system).
 */
router.post('/reject/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Delete sessions first (FK constraint), then user
        await pool.query('DELETE FROM session WHERE "userId" = $1', [userId]);
        await pool.query('DELETE FROM account WHERE "userId" = $1', [userId]);
        const result = await pool.query(
            'DELETE FROM "user" WHERE id = $1 AND approved = false RETURNING id, email',
            [userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found or already approved.' });
        }
        res.json({ message: 'User rejected and removed.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
