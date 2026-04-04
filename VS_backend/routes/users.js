const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth, requireRole, requireElectionRole } = require("../middleware/auth");
/**
 * GET /api/users/my-elections
 * Protected — reads the user id from the JWT cookie (req.user.id).
 * Returns all LIVE or PLANNED elections the authenticated user is assigned to
 * via role_map. Includes role (RO/PRO/PO) and a location_label.
 */
router.get("/my-elections",
    requireAuth, // first, verify JWT and attach req.user 
  async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch all role_map entries for this user tied to active/planned elections
    const rmResult = await pool.query(
      `SELECT
         rm.id           AS role_map_id,
         rm.role,
         rm.relation_id,
         e.election_id,
         e.name          AS election_name,
         e.status,
         e.start_date,
         e.end_date
       FROM role_map rm
       JOIN election e ON e.election_id = rm.election_id
       WHERE rm.user_id = $1
         AND e.status IN ('LIVE', 'PLANNED')
       ORDER BY e.start_date ASC`,
      [userId]
    );

    // Enrich each row with a location_label
    const rows = await Promise.all(
      rmResult.rows.map(async (row) => {
        let location_label = null;
        let booth_number_val = null;

        if (row.role === 'RO') {
          const r = await pool.query(
            `SELECT c.name, c.region
             FROM constituency_of_election coe
             JOIN constituency c ON c.id = coe.constituency_id
             WHERE coe.id = $1`,
            [row.relation_id]
          );
          if (r.rows[0]) {
            const { name, region } = r.rows[0];
            location_label = region ? `${name}, ${region}` : name;
          }
        } else if (row.role === 'PRO') {
          const r = await pool.query(
            `SELECT pc.name, pc.address
             FROM polling_center_of_election poe
             JOIN polling_center pc ON pc.id = poe.polling_center_id
             WHERE poe.id = $1`,
            [row.relation_id]
          );
          if (r.rows[0]) {
            const { name, address } = r.rows[0];
            location_label = address ? `${name} — ${address}` : name;
          }
        } else if (row.role === 'PO') {
          const r = await pool.query(
            `SELECT pb.booth_number, pc.name AS center_name
             FROM polling_booth pb
             JOIN polling_center pc ON pc.id = pb.polling_center_id
             WHERE pb.id = $1`,
            [row.relation_id]
          );
          if (r.rows[0]) {
            const { booth_number, center_name } = r.rows[0];
            location_label = `Booth #${booth_number} — ${center_name}`;
            booth_number_val = booth_number;
          }
        }

        let coe_id = null;
        let constituency_name = null;
        let poe_id = null;
        let polling_center_id = null;
        let booth_id = null;

        if (row.role === 'RO') {
          coe_id = row.relation_id;
          constituency_name = location_label ? location_label.split(',')[0].trim() : null;
        } else if (row.role === 'PRO') {
          poe_id = row.relation_id;
          const pcRow = await pool.query(
            'SELECT polling_center_id FROM polling_center_of_election WHERE id = $1',
            [row.relation_id]
          );
          if (pcRow.rows[0]) polling_center_id = pcRow.rows[0].polling_center_id;
        } else if (row.role === 'PO') {
          booth_id = row.relation_id;
        }

        return {
          election_id: row.election_id,
          election_name: row.election_name,
          status: row.status,
          start_date: row.start_date,
          end_date: row.end_date,
          role: row.role,
          location_label,
          booth_number: booth_number_val,
          coe_id,
          constituency_name,
          poe_id,
          polling_center_id,
          booth_id,
        };
      })
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/users/with-active-roles
 * Returns all approved users (system role = USER) with their name, email,
 * and a count of how many role_map entries they have in active (PLANNED/LIVE) elections.
 */
router.get("/with-active-roles",
  requireAuth,
  async (req, res, next) => {
    if (req.user.role === "ADMIN") return next();
    return res.status(403).json({ error: "Forbidden" });
  },
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           u.id,
           u.name,
           u.email,
           COUNT(rm.id) FILTER (
             WHERE (
               CASE rm.role
                 WHEN 'RO'  THEN (
                   SELECT e.status FROM election e
                   JOIN constituency_of_election coe ON coe.election_id = e.election_id
                   WHERE coe.id = rm.relation_id
                   LIMIT 1
                 )
                 WHEN 'PRO' THEN (
                   SELECT e.status FROM election e
                   JOIN polling_center_of_election poe ON poe.election_id = e.election_id
                   WHERE poe.id = rm.relation_id
                   LIMIT 1
                 )
                 WHEN 'PO'  THEN (
                   SELECT e.status FROM election e
                   JOIN polling_booth pb ON pb.election_id = e.election_id
                   WHERE pb.id = rm.relation_id
                   LIMIT 1
                 )
               END
             ) IN ('PLANNED', 'LIVE')
           )::int AS active_roles_count
         FROM users u
         LEFT JOIN role_map rm ON rm.user_id = u.id
         WHERE u.role = 'USER'
           AND u.approved = true
         GROUP BY u.id, u.name, u.email
         ORDER BY u.name ASC`
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * GET /api/users
 * Get ALL approved users (system role = USER)
 */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email, role, approved, created_at FROM users ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/users/assignable-for-election?election_id=<id>
 * Get approved USER-role users NOT already assigned any role in the given election.
 * Used for both RO (admin) and PRO (RO dashboard) pickers.
 */
router.get("/assignable-for-election", 
    requireAuth, // first, verify JWT and attach req.user
  async (req, res) => {
  const { election_id } = req.query;
  if (!election_id) {
    return res.status(400).json({ error: "election_id is required" });
  }
  try {
    const result = await pool.query(
      `SELECT u.id, u.name
       FROM users u
       WHERE u.role = 'USER'
         AND u.approved = true
         AND u.id NOT IN (
           SELECT rm.user_id
           FROM role_map rm
           WHERE rm.election_id = $1
         )
       ORDER BY u.name`,
      [election_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/users/assignable
 * Get all approved users with role = USER (assignable as officers)
 */
router.get("/assignable", async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM users WHERE role = $1 AND approved = true ORDER BY name',
      ["USER"]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
