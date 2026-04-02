const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * GET /api/voter/my-elections?email=<email>&nid=<nid>
 * Returns all elections the voter (matched by email or NID) is assigned to.
 */
router.get('/my-elections', async (req, res) => {
    const { email, nid } = req.query;
    if (!email && !nid) return res.status(400).json({ error: 'Email or NID is required' });

    try {
        const result = await pool.query(
            `SELECT 
                e.election_id, 
                e.name, 
                e.start_date, 
                e.end_date, 
                e.status
             FROM election e
             JOIN voter_of_election voe ON voe.election_id = e.election_id
             JOIN voter v ON v.nid = voe.nid
             WHERE ($1::text IS NULL OR v.email = $1)
               AND ($2::text IS NULL OR v.nid::text = $2)
             ORDER BY e.start_date DESC`,
            [email || null, nid || null]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching voter elections' });
    }
});

/**
 * GET /api/voter/election/:id/details?email=<email>&nid=<nid>
 * Returns voter info and their assigned polling center details.
 */
router.get('/election/:id/details', async (req, res) => {
    const { id: electionId } = req.params;
    const { email, nid } = req.query;

    try {
        const result = await pool.query(
            `SELECT 
                v.nid, 
                v.name AS voter_name, 
                c.name AS constituency_name,
                pc.name AS center_name, 
                pc.address AS center_address, 
                pc.lat, 
                pc.lng,
                voe.booth_id,
                pb.booth_number,
                voe.id AS voe_id
             FROM voter v
             JOIN voter_of_election voe ON voe.nid = v.nid
             JOIN constituency c ON c.id = v.constituency_id
             LEFT JOIN polling_center pc ON pc.id = voe.center_id
             LEFT JOIN polling_booth pb ON pb.id = voe.booth_id
             WHERE ($1::text IS NULL OR v.email = $1)
               AND ($2::text IS NULL OR v.nid::text = $2)
               AND voe.election_id = $3`,
            [email || null, nid || null, electionId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No assignment found for this election' });
        }

        const otpCheck = await pool.query(
            "SELECT 1 FROM voter_otp WHERE voter_of_election_id = $1 LIMIT 1",
            [result.rows[0].voe_id]
        );

        res.json({
            ...result.rows[0],
            has_voted: otpCheck.rows.length > 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching election details' });
    }
});

/**
 * GET /api/voter/election/:id/stats?email=<email>&nid=<nid>
 * Aggregated results for the voter's constituency.
 */
router.get('/election/:id/stats', async (req, res) => {
    const { id: electionId } = req.params;
    const { email, nid } = req.query;

    try {
        const coeRes = await pool.query(
            `SELECT coe.id AS coe_id, c.name, coe.election_id
             FROM constituency_of_election coe
             JOIN voter v ON v.constituency_id = coe.constituency_id
             JOIN constituency c ON c.id = v.constituency_id
             WHERE ($1::text IS NULL OR v.email = $1)
               AND ($2::text IS NULL OR v.nid::text = $2)
               AND coe.election_id = $3`,
            [email || null, nid || null, electionId]
        );

        if (coeRes.rows.length === 0) {
            return res.status(404).json({ error: 'Voter or constituency not found' });
        }
        const { coe_id, name: constituency_name } = coeRes.rows[0];

        const statsRes = await pool.query(
            `SELECT 
                (SELECT COUNT(*) FROM voter_of_election voe 
                 JOIN voter v2 ON v2.nid = voe.nid 
                 WHERE voe.election_id = $1 AND v2.constituency_id = coe_outer.constituency_id) AS total_assigned,
                COUNT(vl.voter_token) AS votes_cast
             FROM voting_log vl
             JOIN constituency_of_election coe_outer ON coe_outer.id = vl.constituency_of_election_id
             WHERE vl.constituency_of_election_id = $2
             GROUP BY coe_outer.constituency_id`,
            [electionId, coe_id]
        );

        const candidatesRes = await pool.query(
            `SELECT 
                ca.name, 
                ca.party, 
                COUNT(vl.voter_token) AS votes
             FROM candidate ca
             LEFT JOIN voting_log vl ON vl.candidate_id = ca.candidate_id AND vl.constituency_of_election_id = $1
             WHERE ca.constituency_of_election_id = $1
             GROUP BY ca.candidate_id, ca.name, ca.party
             ORDER BY votes DESC`,
            [coe_id]
        );

        res.json({
            constituency_name,
            summary: statsRes.rows[0] || { total_assigned: 0, votes_cast: 0 },
            candidates: candidatesRes.rows.map(c => ({
                ...c,
                votes: parseInt(c.votes)
            }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching election results' });
    }
});

/**
 * POST /api/voter/verify-token
 * Verify a voting token. Returns candidate and party name.
 */
router.post('/verify-token', async (req, res) => {
    const { token, election_id } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    try {
        const result = await pool.query(
            `SELECT ca.name AS candidate_name, ca.party, e.name AS election_name, e.status
             FROM voting_log vl
             JOIN candidate ca ON ca.candidate_id = vl.candidate_id
             JOIN constituency_of_election coe ON coe.id = vl.constituency_of_election_id
             JOIN election e ON e.election_id = coe.election_id
             WHERE vl.voter_token = $1`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid Token' });
        }

        const vote = result.rows[0];

        if (vote.status !== 'FINALIZED') {
            return res.status(403).json({ error: 'Verification available after election is finalized.' });
        }

        res.json({
            candidate_name: vote.candidate_name,
            party: vote.party,
            election_name: vote.election_name
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during verification' });
    }
});

module.exports = router;
