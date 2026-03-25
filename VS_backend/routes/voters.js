const express = require("express");
const router = express.Router();
const pool = require("../db");
const crypto = require("crypto");

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
        const fingerprint_hash = crypto.randomBytes(32).toString('hex');
        const result = await pool.query(
            `INSERT INTO voter (nid, name, phone, email, voter_type, constituency_id, lat, lng, fingerprint_hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [nid, name, phone, email, voter_type, constituency_id, lat, lng, fingerprint_hash]
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
                const fingerprint_hash = crypto.randomBytes(32).toString('hex');
                await client.query(
                    `INSERT INTO voter (nid, name, phone, email, voter_type, constituency_id, lat, lng, fingerprint_hash)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [nid, name, phone, email, voter_type, constituency_id, lat, lng, fingerprint_hash]
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

/**
 * GET /api/voters
 * Get paginated list of voters with search and constituency filter.
 */
router.get("/", async (req, res) => {
    try {
        const { search, constituency_id, page = 1, limit = 10 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        let baseQuery = "FROM voter WHERE 1=1";
        const params = [];

        if (search) {
            baseQuery += ` AND (name ILIKE $${params.length + 1} OR nid::text ILIKE $${params.length + 1})`;
            params.push(`%${search}%`);
        }

        if (constituency_id && constituency_id !== 'all') {
            baseQuery += ` AND constituency_id = $${params.length + 1}`;
            params.push(constituency_id);
        }

        const countRes = await pool.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
        const total = parseInt(countRes.rows[0].total || 0);

        const dataRes = await pool.query(
            `SELECT * ${baseQuery} ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limitNum, offset]
        );

        res.json({
            data: dataRes.rows,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        console.error("Voters API Error:", err);
        res.status(500).json({ error: "Fetch error: " + err.message });
    }
});

/**
 * PUT /api/voters/:nid
 * Update voter details.
 */
router.put("/:nid", async (req, res) => {
    const { nid } = req.params;
    const { name, phone, email, voter_type, constituency_id, lat, lng } = req.body;

    if (!name || !constituency_id) {
        return res.status(400).json({ error: "Name and Constituency ID are required." });
    }

    try {
        const result = await pool.query(
            `UPDATE voter 
             SET name = $1, phone = $2, email = $3, voter_type = $4, constituency_id = $5, lat = $6, lng = $7
             WHERE nid = $8
             RETURNING *`,
            [name, phone, email, voter_type, constituency_id, lat, lng, nid]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Voter not found." });
        }

        res.json({
            message: "Voter updated successfully",
            voter: result.rows[0]
        });
    } catch (err) {
        console.error("Error updating voter:", err);
        res.status(500).json({ error: "Server error while updating voter." });
    }
});

/**
 * DELETE /api/voters/:nid
 * Delete a voter after checking dependencies.
 */
router.delete("/:nid", async (req, res) => {
    const { nid } = req.params;

    try {
        // Check if voter is assigned to any election (referential integrity)
        const check = await pool.query("SELECT id FROM voter_of_election WHERE nid = $1 LIMIT 1", [nid]);
        if (check.rows.length > 0) {
            return res.status(400).json({ 
                error: "Cannot delete voter. They are already assigned to an election. Please remove them from all elections first." 
            });
        }

        const result = await pool.query("DELETE FROM voter WHERE nid = $1 RETURNING *", [nid]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Voter not found." });
        }

        res.json({ message: "Voter deleted successfully" });
    } catch (err) {
        console.error("Error deleting voter:", err);
        res.status(500).json({ error: "Server error while deleting voter." });
    }
});

module.exports = router;
