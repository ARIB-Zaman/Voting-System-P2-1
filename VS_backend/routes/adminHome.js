const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET all elections
router.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM election");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST new election
router.post("/", async (req, res) => {
    const { name, description, start_date, end_date, status } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO election (name, start_date, end_date, status)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, start_date, end_date, status]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            "SELECT * FROM election WHERE election_id=$1",
            [id]
        )
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
});

// PUT update election
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { name, description, start_date, end_date, status } = req.body;

    try {
        const result = await pool.query(
            `UPDATE election
             SET name = COALESCE($1, name),
                 start_date = COALESCE($2, start_date),
                 end_date = COALESCE($3, end_date),
                 status = COALESCE($4, status)
             WHERE election_id = $5
             RETURNING *`,
            [name, start_date, end_date, status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Election not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE election (constituencies cascade via ON DELETE CASCADE or manual)
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        // Delete constituencies first
        await client.query("DELETE FROM constituency WHERE election_id = $1", [id]);
        // Delete election
        const result = await client.query(
            "DELETE FROM election WHERE election_id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Election not found" });
        }

        await client.query("COMMIT");
        res.json({ message: "Election deleted", election: result.rows[0] });
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;
