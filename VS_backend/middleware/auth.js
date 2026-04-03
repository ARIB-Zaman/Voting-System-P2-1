require('dotenv').config();
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

/**
 * Verifies the JWT from the httpOnly cookie.
 * Attaches req.user = { id, name, email, role, approved } on success.
 */
async function requireAuth(req, res, next) {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: payload.sub,
            name: payload.name,
            email: payload.email,
            role: payload.role,
            approved: payload.approved,
        };
        next();
    } catch {
        return res.status(401).json({ error: 'Unauthorized' });
    }
}

/**
 * System-level role guard (ADMIN / USER).
 * Must come after requireAuth.
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
}

/**
 * Election-scoped role guard.
 * Checks that the authenticated user has the given role in role_map
 * where relation_id === req.params[paramName].
 *
 * Usage: requireElectionRole('RO', 'coeId')
 */
function requireElectionRole(role, paramName, source = 'params') {
    return async (req, res, next) => {
        const userId = req.user?.id;
        const relationId = req[source]?.[paramName];
        
        if (!userId || !relationId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        try {
            const result = await pool.query(
                `SELECT 1 FROM role_map
                 WHERE user_id = $1 AND role = $2 AND relation_id = $3`,
                [userId, role, relationId]
            );
            if (result.rowCount === 0) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            next();
        } catch {
            return res.status(500).json({ error: 'Server error' });
        }
    };
}

/**
 * Election-scoped guard that checks if the user is a PRO for ANY booth
 * inside the given poe (polling_center_of_election).
 * Used for endpoints parameterized by poeId where user must be PRO.
 */
function requireProForPoe(paramName) {
    return async (req, res, next) => {
        const userId = req.user?.id;
        const poeId = req.params[paramName];
        if (!userId || !poeId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        try {
            const result = await pool.query(
                `SELECT 1 FROM role_map
                 WHERE user_id = $1 AND role = 'PRO' AND relation_id = $2`,
                [userId, poeId]
            );
            if (result.rowCount === 0) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            next();
        } catch {
            return res.status(500).json({ error: 'Server error' });
        }
    };
}

/**
 * Check if a user is RO owning the coe that contains the given poe.
 * Used to guard poe-level mutations (add/remove polling centers, assign PRO).
 */
function requireRoForPoe(paramName) {
    return async (req, res, next) => {
        const userId = req.user?.id;
        const poeId = req.params[paramName];
        if (!userId || !poeId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        try {
            // Find the coe that contains this poe
            const coeRes = await pool.query(
                `SELECT poe.election_id, coe.id AS coe_id
                 FROM polling_center_of_election poe
                 JOIN constituency_of_election coe
                   ON coe.election_id = poe.election_id
                      AND coe.constituency_id = (
                            SELECT pc.constituency_id
                            FROM polling_center pc
                            WHERE pc.id = poe.polling_center_id
                      )
                 WHERE poe.id = $1`,
                [poeId]
            );
            if (coeRes.rowCount === 0) {
                return res.status(404).json({ error: 'Not found' });
            }
            const coeId = coeRes.rows[0].coe_id;
            const check = await pool.query(
                `SELECT 1 FROM role_map
                 WHERE user_id = $1 AND role = 'RO' AND relation_id = $2`,
                [userId, coeId]
            );
            if (check.rowCount === 0) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            req.resolvedCoeId = coeId;
            next();
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Server error' });
        }
    };
}

module.exports = { requireAuth, requireRole, requireElectionRole, requireProForPoe, requireRoForPoe, JWT_SECRET, JWT_EXPIRES_IN };
