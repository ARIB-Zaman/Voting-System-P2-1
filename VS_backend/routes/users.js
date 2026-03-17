const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * GET /api/users/my-elections?userId=<id>
 * Returns all LIVE or PLANNED elections the given user is assigned to via role_map.
 * Includes role (RO/PRO/PO) and a location_label describing their jurisdiction.
 */
router.get("/my-elections", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId is required" });

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

        if (row.role === 'RO') {
          // relation_id → constituency_of_election → constituency
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
          // relation_id → polling_center_of_election → polling_center
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
          // relation_id → polling_booth → polling_center
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
          }
        }

        // For RO, expose coe_id and constituency_name
        let coe_id = null;
        let constituency_name = null;

        if (row.role === 'RO') {
          coe_id = row.relation_id;
          // location_label for RO is "name" or "name, region" — extract name part
          constituency_name = location_label ? location_label.split(',')[0].trim() : null;
        }

        return {
          election_id: row.election_id,
          election_name: row.election_name,
          status: row.status,
          start_date: row.start_date,
          end_date: row.end_date,
          role: row.role,
          location_label,
          coe_id,
          constituency_name,
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
 * GET /api/users
 * Get ALL users
 */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/users/ro
 * Get users with role = RO
 */
router.get("/ro", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM public.\"user\" WHERE role = $1 AND approved = true",
      ["RO"]
    );

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/users/pro
 * Get users with role = PRO (Presiding Officers)
 */
router.get("/pro", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM public.\"user\" WHERE role = $1 AND approved = true",
      ["PRO"]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/users/po
 * Get users with role = PO (Polling Officers)
 */
router.get("/po", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM public.\"user\" WHERE role = $1 AND approved = true",
      ["PO"]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/users/assignable
 * Get all approved users with role = USER (assignable as Returning Officer)
 */
router.get("/assignable", async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM public."user" WHERE role = $1 AND approved = true ORDER BY name',
      ["USER"]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

