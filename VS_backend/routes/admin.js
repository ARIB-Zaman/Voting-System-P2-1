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
            `SELECT id, name, email, role, created_at AS "createdAt"
             FROM users
             WHERE approved = false
             ORDER BY created_at DESC`
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
            'UPDATE users SET approved = true WHERE id = $1 RETURNING id, name, email, role',
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
 * Cascades to role_map automatically.
 */
router.post('/reject/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM users WHERE id = $1 AND approved = false RETURNING id, email',
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
