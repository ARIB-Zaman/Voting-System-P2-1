const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET all constituencies
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM constituency");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET constituencies for a specific election (with RO name)
router.get("/election/:electionId", async (req, res) => {
  const { electionId } = req.params;
  try {
    const result = await pool.query(
      `SELECT c.constituency_id, c.name, c.region, c.election_id, c.ro_id,
              u.name AS ro_name
       FROM constituency c
       LEFT JOIN public."user" u ON c.ro_id = u.id
       WHERE c.election_id = $1
       ORDER BY c.constituency_id`,
      [electionId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST batch constituencies (existing — used by create election)
router.post("/", async (req, res) => {
  const { election_id, constituencies } = req.body;

  if (!election_id || !Array.isArray(constituencies)) {
    return res.status(400).json({
      error: "election_id and constituencies array are required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const c of constituencies) {
      const { name, region, ro_id } = c;

      if (!name || !region) {
        throw new Error("Constituency name and region are required");
      }

      await client.query(
        `INSERT INTO constituency (name, region, election_id, ro_id)
         VALUES ($1, $2, $3, $4)`,
        [name, region, election_id, ro_id || null]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ message: "Constituencies created successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST single constituency
router.post("/single", async (req, res) => {
  const { name, region, election_id, ro_id } = req.body;

  if (!name || !region || !election_id) {
    return res.status(400).json({
      error: "name, region, and election_id are required",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO constituency (name, region, election_id, ro_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, region, election_id, ro_id || null]
    );

    // Fetch with RO name
    const full = await pool.query(
      `SELECT c.*, u.name AS ro_name
       FROM constituency c
       LEFT JOIN public."user" u ON c.ro_id = u.id
       WHERE c.constituency_id = $1`,
      [result.rows[0].constituency_id]
    );

    res.status(201).json(full.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update constituency
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, region, ro_id } = req.body;

  try {
    const result = await pool.query(
      `UPDATE constituency
       SET name = COALESCE($1, name),
           region = COALESCE($2, region),
           ro_id = $3
       WHERE constituency_id = $4
       RETURNING *`,
      [name, region, ro_id || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Constituency not found" });
    }

    // Fetch with RO name
    const full = await pool.query(
      `SELECT c.*, u.name AS ro_name
       FROM constituency c
       LEFT JOIN public."user" u ON c.ro_id = u.id
       WHERE c.constituency_id = $1`,
      [id]
    );

    res.json(full.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE constituency
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM constituency WHERE constituency_id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Constituency not found" });
    }

    res.json({ message: "Constituency deleted", constituency: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;