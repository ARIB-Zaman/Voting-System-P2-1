const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth } = require('../auth');

/**
 * POST /api/signup
 * Public endpoint — creates a new user with approved = false.
 * Body: { name, email, password, role }
 * role must be 'RO', 'PO', or 'PRO' (ADMIN cannot be self-registered).
 */
router.post('/', async (req, res) => {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required (name, email, password, role).' });
    }

    // Only RO, PO, and PRO can self-register
    const allowedRoles = ['RO', 'PO', 'PRO'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Role must be RO, PO, or PRO.' });
    }

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM "user" WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    try {
        // Create user via BetterAuth API (handles password hashing)
        const result = await auth.api.signUpEmail({
            body: { email, password, name },
        });

        if (result && result.user) {
            // Set the role and approved = false
            await pool.query(
                'UPDATE "user" SET role = $1, approved = false WHERE id = $2',
                [role, result.user.id]
            );

            // Delete any session BetterAuth may have created during sign-up
            // (user shouldn't be logged in until approved)
            await pool.query('DELETE FROM session WHERE "userId" = $1', [result.user.id]);

            return res.status(201).json({
                message: 'Sign-up successful! Your account is pending admin approval.',
            });
        }

        return res.status(500).json({ error: 'Failed to create account. Please try again.' });
    } catch (err) {
        console.error('Sign-up error:', err.message || err);

        // BetterAuth might throw if email is already taken at its level
        if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate')) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }

        return res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }
});

module.exports = router;
