const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');

/**
 * POST /api/signup
 * Public endpoint — creates a new user with approved = false.
 * Body: { name, email, password }
 * All self-registered users receive the 'USER' role.
 * ADMIN accounts cannot be self-registered.
 */
router.post('/', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required (name, email, password).' });
    }

    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    try {
        // Check email uniqueness
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }

        // Hash password
        const hashed = await bcrypt.hash(password, 12);

        // Insert user — role defaults to 'USER', approved defaults to false
        await pool.query(
            `INSERT INTO users (name, email, password, role, approved)
             VALUES ($1, $2, $3, 'USER', false)`,
            [name, email, hashed]
        );

        return res.status(201).json({
            message: 'Sign-up successful! Your account is pending admin approval.',
        });
    } catch (err) {
        console.error('Sign-up error:', err.message || err);
        return res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }
});

module.exports = router;
