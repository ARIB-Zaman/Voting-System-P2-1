const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * POST /api/voters/add-voter
 * Add a single voter to the master list.
 */
router.post("/add-voter", async (req, res) => {
    const { nid, name, phone, email, voter_type, constituency_id, lat, lng } = req.body;

    // Basic validation
    if (!nid || !name || !constituency_id) {
        return res.status(400).json({ error: "NID, Name, and Constituency ID are required." });
    }

    const validTypes = ['NORMAL', 'POSTAL'];
    if (voter_type && !validTypes.includes(voter_type)) {
        return res.status(400).json({ error: "Invalid Voter Type. Must be NORMAL or POSTAL." });
    }

    try {
        // Check if NID already exists
        const existing = await pool.query("SELECT nid FROM voter WHERE nid = $1", [nid]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: "Voter with this NID already exists." });
        }

        // Insert new voter
        const result = await pool.query(
            `INSERT INTO voter (nid, name, phone, email, voter_type, constituency_id, lat, lng)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [nid, name, phone, email, voter_type, constituency_id, lat, lng]
        );

        res.status(201).json({
            message: "Voter added successfully",
            voter: result.rows[0]
        });
    } catch (err) {
        console.error("Error adding voter:", err);
        res.status(500).json({ error: "Server error while adding voter." });
    }
});

/**
 * POST /api/voters/bulk-upload-voters
 * Add multiple voters. Skip if NID exists.
 */
router.post("/bulk-upload-voters", async (req, res) => {
    const { voters } = req.body;

    if (!Array.isArray(voters) || voters.length === 0) {
        return res.status(400).json({ error: "No voters data provided." });
    }

    let processed = 0;
    let added = 0;
    let skipped = 0;
    let errors = 0;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        for (const voter of voters) {
            processed++;
            const { nid, name, phone, email, voter_type, constituency_id, lat, lng } = voter;

            // Simple validation for each row
            if (!nid || !name || !constituency_id) {
                skipped++;
                continue;
            }

            try {
                // Check if NID exists
                const existing = await client.query("SELECT nid FROM voter WHERE nid = $1", [nid]);
                if (existing.rows.length > 0) {
                    skipped++;
                    continue;
                }

                // Insert
                await client.query(
                    `INSERT INTO voter (nid, name, phone, email, voter_type, constituency_id, lat, lng)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [nid, name, phone, email, voter_type, constituency_id, lat, lng]
                );
                added++;
            } catch (innerErr) {
                console.error(`Error processing row with NID ${nid}:`, innerErr);
                errors++;
                // We continue to next row instead of failing everything
            }
        }

        await client.query("COMMIT");

        res.json({
            summary: {
                total: processed,
                added: added,
                skipped: skipped,
                errors: errors
            },
            message: `Processed ${processed} rows. Added: ${added}, Skipped: ${skipped}, Errors: ${errors}.`
        });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Bulk upload transaction failed:", err);
        res.status(500).json({ error: "Server error during bulk upload." });
    } finally {
        client.release();
    }
});

module.exports = router;
