const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * GET /api/admin-polling-centers
 * Returns all polling centers with constituency name.
 * Optional query: ?constituency_id=1&q=search_term
 */
router.get('/', async (req, res) => {
  const { constituency_id, q = '' } = req.query;
  try {
    const conditions = [];
    const params = [];

    if (constituency_id) {
      params.push(constituency_id);
      conditions.push(`pc.constituency_id = $${params.length}`);
    }
    if (q) {
      const pattern = `%${q}%`;
      params.push(pattern);
      const p1 = params.length;
      params.push(pattern);
      const p2 = params.length;
      conditions.push(`(pc.name ILIKE $${p1} OR pc.address ILIKE $${p2})`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await pool.query(
      `SELECT
         pc.id,
         pc.name,
         pc.address,
         pc.constituency_id,
         c.name AS constituency_name,
         pc.lat,
         pc.lng
       FROM polling_center pc
       LEFT JOIN constituency c ON c.id = pc.constituency_id
       ${where}
       ORDER BY c.name ASC, pc.name ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin-polling-centers
 * Create a new polling center.
 * Body: { name, address, constituency_id, lat, lng }
 */
router.post('/', async (req, res) => {
  const { name, address, constituency_id, lat, lng } = req.body;

  if (!name || !address || !constituency_id) {
    return res.status(400).json({ error: 'name, address, and constituency_id are required' });
  }

  try {
    // Check for duplicate name
    const dup = await pool.query(
      'SELECT id FROM polling_center WHERE LOWER(name) = LOWER($1)',
      [name]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: `A polling center named "${name}" already exists` });
    }

    const result = await pool.query(
      `INSERT INTO polling_center (name, address, constituency_id, lat, lng)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name.trim(), address.trim(), constituency_id, lat ?? null, lng ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin-polling-centers/bulk
 * Bulk create polling centers from CSV upload.
 * Body: { centers: [{ name, address, constituency_id, lat, lng }] }
 */
router.post('/bulk', async (req, res) => {
  const { centers } = req.body;
  
  if (!Array.isArray(centers) || centers.length === 0) {
    return res.status(400).json({ error: 'No polling centers provided' });
  }

  const results = {
    total: centers.length,
    inserted: 0,
    failed: 0,
    errors: []
  };

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const namesInBatch = new Set();

    for (let i = 0; i < centers.length; i++) {
      const row = centers[i];
      const rowNum = i + 1; // 1-indexed for user friendly errors
      
      const name = row.name ? String(row.name).trim() : '';
      const address = row.address ? String(row.address).trim() : '';
      const constituency_id = parseInt(row.constituency_id, 10);
      const lat = row.latitude ? parseFloat(row.latitude) : null;
      const lng = row.longitude ? parseFloat(row.longitude) : null;

      if (!name || !address || isNaN(constituency_id)) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: Missing 'name', 'address', or valid 'constituency_id'.`);
        continue;
      }

      const lowerName = name.toLowerCase();

      if (namesInBatch.has(lowerName)) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: Duplicate name "${name}" found within the CSV file.`);
        continue;
      }
      
      const dupQuery = await client.query(
        'SELECT id FROM polling_center WHERE LOWER(name) = $1',
        [lowerName]
      );
      
      if (dupQuery.rows.length > 0) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: Polling center named "${name}" already exists in the system.`);
        continue;
      }

      const constQuery = await client.query(
        'SELECT id FROM constituency WHERE id = $1',
        [constituency_id]
      );

      if (constQuery.rows.length === 0) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: Constituency ID ${constituency_id} does not exist.`);
        continue;
      }

      await client.query(
        `INSERT INTO polling_center (name, address, constituency_id, lat, lng)
         VALUES ($1, $2, $3, $4, $5)`,
        [name, address, constituency_id, isNaN(lat) ? null : lat, isNaN(lng) ? null : lng]
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

/**
 * PUT /api/admin-polling-centers/:id
 * Update a polling center.
 * Body: { name, address, constituency_id, lat, lng }
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, address, constituency_id, lat, lng } = req.body;

  if (!name || !address || !constituency_id) {
    return res.status(400).json({ error: 'name, address, and constituency_id are required' });
  }

  try {
    // Check for duplicate name (excluding self)
    const dup = await pool.query(
      'SELECT id FROM polling_center WHERE LOWER(name) = LOWER($1) AND id != $2',
      [name, id]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: `A polling center named "${name}" already exists` });
    }

    const result = await pool.query(
      `UPDATE polling_center
       SET name = $1, address = $2, constituency_id = $3, lat = $4, lng = $5
       WHERE id = $6
       RETURNING *`,
      [name.trim(), address.trim(), constituency_id, lat ?? null, lng ?? null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Polling center not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/admin-polling-centers/:id
 * Delete a polling center.
 * Blocked if the center is referenced in polling_center_of_election.
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Check if the center is assigned to any election
    const inUse = await pool.query(
      'SELECT id FROM polling_center_of_election WHERE polling_center_id = $1 LIMIT 1',
      [id]
    );
    if (inUse.rows.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete: this polling center is currently assigned to one or more elections. Remove those assignments first.'
      });
    }

    const result = await pool.query(
      'DELETE FROM polling_center WHERE id = $1 RETURNING id, name',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Polling center not found' });
    }

    res.json({ message: `Polling center "${result.rows[0].name}" deleted successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
