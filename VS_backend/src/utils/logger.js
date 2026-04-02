const pool = require('../../db');

async function createAuditLog(userId, actionType, tableName, targetEntityId, details) {
    try {
        await pool.query(
            `INSERT INTO audit_log (user_id, action_type, table_name, target_entity_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, actionType, tableName, targetEntityId, details ? JSON.stringify(details) : null]
        );
    } catch (err) {
        console.error('Failed to write audit log:', err);
    }
}

module.exports = { createAuditLog };
