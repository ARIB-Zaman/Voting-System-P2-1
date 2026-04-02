const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: sets httpOnly JWT cookie, returns user object.
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const result = await pool.query(
            'SELECT id, name, email, password, role, approved FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = result.rows[0];

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        if (!user.approved) {
            return res.status(403).json({ error: 'Your account is pending admin approval. Please wait for an administrator to approve your access.' });
        }

        const payload = {
            sub: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            approved: user.approved,
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
        });

        return res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                approved: user.approved,
            },
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
});

/**
 * POST /api/auth/logout
 * Clears the JWT cookie.
 */
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });
    return res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Returns the current user's info if the JWT cookie is valid.
 * Used by the frontend auth provider's check() and getIdentity().
 */
router.get('/me', async (req, res) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        // Re-fetch from DB to get latest approved/role status
        const result = await pool.query(
            'SELECT id, name, email, role, approved FROM users WHERE id = $1',
            [payload.sub]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found.' });
        }
        const user = result.rows[0];
        return res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            approved: user.approved,
        });
    } catch {
        return res.status(401).json({ error: 'Invalid or expired session.' });
    }
});

module.exports = router;
