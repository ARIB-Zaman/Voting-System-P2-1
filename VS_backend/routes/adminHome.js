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

// POST new user
router.post("/", async (req, res) => {
    const { name, description, start_date, end_date, status } = req.body;

    try {
        
        await pool.query(
            "INSERT INTO election (name, start_date, end_date, status) VALUES ($1, $2, $3, $4)",
            [name, start_date, end_date, status]   // prevents SQL injection
        );
        
        res.status(201).json({ message: `election added ${name} ${description} ${start_date} ${end_date} ${status}`});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id", async (req, res) => {
    const {id} = req.params;
    try {
        const result = await pool.query(
            "SELECT * FROM election WHERE election_id=$1",
            [id]
        )
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({error: err.message})
    }
});

module.exports = router;
