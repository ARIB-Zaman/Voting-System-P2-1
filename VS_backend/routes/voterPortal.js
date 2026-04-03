const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * POST /api/voter-portal/login
 * Validates if the NID exists in the voter_of_election table.
 */
router.post('/login', async (req, res) => {
    const { nid } = req.body;
    if (!nid) return res.status(400).json({ error: 'NID is required' });

    try {
        const result = await pool.query(
            `SELECT v.nid, v.name 
             FROM voter v
             JOIN voter_of_election voe ON voe.nid = v.nid
             WHERE v.nid::text = $1
             LIMIT 1`,
            [nid]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Voter not found or not assigned to any election.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during voter login' });
    }
});

/**
 * GET /api/voter-portal/my-elections?nid=<nid>
 */
router.get('/my-elections', async (req, res) => {
    const { nid } = req.query;
    if (!nid) return res.status(400).json({ error: 'NID is required' });

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
             WHERE v.nid::text = $1
             ORDER BY e.start_date DESC`,
            [nid]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching elections' });
    }
});

/**
 * GET /api/voter-portal/details?nid=<nid>&election_id=<id>
 */
router.get('/details', async (req, res) => {
    const { nid, election_id } = req.query;
    if (!nid || !election_id) return res.status(400).json({ error: 'NID and Election ID are required' });

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
             WHERE v.nid::text = $1 AND voe.election_id = $2`,
            [nid, election_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No assignment found' });
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
        res.status(500).json({ error: 'Server error fetching details' });
    }
});

/**
 * GET /api/voter-portal/stats?election_id=<id>&nid=<nid>
 */
router.get('/stats', async (req, res) => {
    const { election_id, nid } = req.query;
    if (!election_id || !nid) return res.status(400).json({ error: 'Election ID and NID are required' });

    try {
        const coeRes = await pool.query(
            `SELECT coe.id AS coe_id, c.name, coe.election_id
             FROM constituency_of_election coe
             JOIN voter v ON v.constituency_id = coe.constituency_id
             JOIN constituency c ON c.id = v.constituency_id
             WHERE v.nid::text = $1 AND coe.election_id = $2`,
            [nid, election_id]
        );

        if (coeRes.rows.length === 0) return res.status(404).json({ error: 'Constituency not found' });
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
            [election_id, coe_id]
        );

        const candidatesRes = await pool.query(
            `SELECT ca.name, ca.party, COUNT(vl.voter_token) AS votes
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
        res.status(500).json({ error: 'Server error fetching stats' });
    }
});

/**
 * GET /api/voter-portal/verify-vote/:token
 */
router.get('/verify-vote/:token', async (req, res) => {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    try {
        const result = await pool.query(
            `SELECT ca.name AS candidate_name, ca.party, e.name AS election_name, e.status, e.election_id
             FROM voting_log vl
             JOIN candidate ca ON ca.candidate_id = vl.candidate_id
             JOIN constituency_of_election coe ON coe.id = vl.constituency_of_election_id
             JOIN election e ON e.election_id = coe.election_id
             WHERE vl.voter_token = $1`,
            [token]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Invalid Token' });
        
        const vote = result.rows[0];
        if (vote.status !== 'FINALIZED') {
            return res.status(403).json({ error: 'Verification available after election completion' });
        }

        res.json({
            candidate_name: vote.candidate_name,
            party: vote.party,
            election_name: vote.election_name,
            election_id: vote.election_id
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during verification' });
    }
});

module.exports = router;
