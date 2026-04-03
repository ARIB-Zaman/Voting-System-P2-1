const pool = require('../../db');

async function createAuditLog(userId, actionType, tableName, targetEntityId, details) {
    try {
        let safeUserId = userId;
        
        // If system, find the first ADMIN user's ID
        if (userId === 'system' || !userId) {
            const adminResult = await pool.query('SELECT id FROM "user" WHERE role = \'ADMIN\' LIMIT 1');
            if (adminResult.rows.length > 0) {
                safeUserId = adminResult.rows[0].id;
            } else {
                return; // Can't write audit log without a user
            }
        }

        await pool.query(
            `INSERT INTO audit_log (user_id, action_type, table_name, target_entity_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [safeUserId, actionType, tableName, targetEntityId, details ? JSON.stringify(details) : null]
        );
    } catch (err) {
        console.error('Failed to write audit log:', err);
    }
}

module.exports = { createAuditLog };
