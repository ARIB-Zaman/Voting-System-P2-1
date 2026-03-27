const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET all constituencies
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM constituency ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all unassigned constituencies for a specific election
router.get("/unassigned/:electionId", async (req, res) => {
  try {
    const { electionId } = req.params;
    const result = await pool.query(
      `SELECT * FROM constituency
       WHERE id NOT IN (
         SELECT constituency_id FROM constituency_of_election WHERE election_id = $1
       )
       ORDER BY name`,
       [electionId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// GET unassigned polling centers for a constituency in a specific election
router.get("/:constituencyId/polling_centers/unassigned/:electionId", async (req, res) => {
  try {
    const { constituencyId, electionId } = req.params;
    const result = await pool.query(
      `SELECT id, name, address FROM polling_center
       WHERE constituency_id = $1
         AND id NOT IN (
           SELECT polling_center_id FROM polling_center_of_election WHERE election_id = $2
         )
       ORDER BY name`,
      [constituencyId, electionId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN CONSTITUENCY OPERATIONS ─────────────────────────────────────────

// POST /api/constituency (Add single constituency)
router.post("/", async (req, res) => {
  const { name, region, lat, lng } = req.body;
  if (!name || !region) {
    return res.status(400).json({ error: "name and region are required" });
  }

  try {
    const dup = await pool.query("SELECT id FROM constituency WHERE LOWER(name) = LOWER($1)", [name.trim()]);
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: `Constituency named "${name}" already exists` });
    }

    const result = await pool.query(
      `INSERT INTO constituency (name, region, lat, lng) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), region.trim(), lat ?? null, lng ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/constituency/bulk (Bulk upload constituencies)
router.post("/bulk", async (req, res) => {
  const { constituencies } = req.body;
  
  if (!Array.isArray(constituencies) || constituencies.length === 0) {
    return res.status(400).json({ error: "No constituencies provided" });
  }

  const results = { total: constituencies.length, inserted: 0, failed: 0, errors: [] };
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const namesInBatch = new Set();

    for (let i = 0; i < constituencies.length; i++) {
      const row = constituencies[i];
      const rowNum = i + 1;
      
      const name = row.name ? String(row.name).trim() : '';
      const region = row.region ? String(row.region).trim() : '';
      const lat = row.latitude ? parseFloat(row.latitude) : null;
      const lng = row.longitude ? parseFloat(row.longitude) : null;

      if (!name || !region) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: Missing 'name' or 'region'.`);
        continue;
      }

      const lowerName = name.toLowerCase();

      if (namesInBatch.has(lowerName)) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: Duplicate name "${name}" found within the CSV file.`);
        continue;
      }
      
      const dupQuery = await client.query('SELECT id FROM constituency WHERE LOWER(name) = $1', [lowerName]);
      if (dupQuery.rows.length > 0) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: Constituency named "${name}" already exists in the system.`);
        continue;
      }

      await client.query(
        `INSERT INTO constituency (name, region, lat, lng) VALUES ($1, $2, $3, $4)`,
        [name, region, isNaN(lat) ? null : lat, isNaN(lng) ? null : lng]
      );
      
      namesInBatch.add(lowerName);
      results.inserted++;
    }

    await client.query("COMMIT");
    res.json({ message: "Bulk upload complete", results });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Bulk upload error:", err);
    res.status(500).json({ error: "Server error during bulk upload: " + err.message });
  } finally {
    client.release();
  }
});

// PUT /api/constituency/:id (Edit a constituency)
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, region, lat, lng } = req.body;
  
  if (!name || !region) {
    return res.status(400).json({ error: "name and region are required" });
  }

  try {
    const dup = await pool.query("SELECT id FROM constituency WHERE LOWER(name) = LOWER($1) AND id != $2", [name.trim(), id]);
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: `Constituency named "${name}" already exists` });
    }

    const result = await pool.query(
      `UPDATE constituency SET name = $1, region = $2, lat = $3, lng = $4 WHERE id = $5 RETURNING *`,
      [name.trim(), region.trim(), lat ?? null, lng ?? null, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "Constituency not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/constituency/:id (Delete a constituency)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Check references in polling_center
    const centers = await pool.query('SELECT id FROM polling_center WHERE constituency_id = $1 LIMIT 1', [id]);
    if (centers.rows.length > 0) {
      return res.status(400).json({ error: "Cannot delete this constituency because it has assigned polling centers." });
    }
    
    // Check references in constituency_of_election (elections)
    const elections = await pool.query('SELECT id FROM constituency_of_election WHERE constituency_id = $1 LIMIT 1', [id]);
    if (elections.rows.length > 0) {
      return res.status(400).json({ error: "Cannot delete this constituency because it is actively used in an election." });
    }

    const result = await pool.query('DELETE FROM constituency WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Constituency not found" });
    res.json({ message: "Constituency deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;