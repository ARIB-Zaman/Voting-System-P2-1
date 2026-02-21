const { auth } = require('../auth');

/**
 * Validates the BetterAuth session from the cookie.
 * Attaches req.user on success.
 */
async function requireAuth(req, res, next) {
    try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session || !session.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.user = session.user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
}

/**
 * Role-based guard. Pass one or more allowed roles.
 * Must be used after requireAuth.
 */
function requireRole(...roles) {
    return (req, res, next) => {
        const userRole = req.user?.role;
        if (!userRole || !roles.includes(userRole)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };
