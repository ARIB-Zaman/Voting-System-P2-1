const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * POST /api/voter-portal/login
 * Validates if the NID exists in the voter_of_election table.
 * Returns voter name + constituency_id.
 */
router.post('/login', async (req, res) => {
    const { nid } = req.body;
    if (!nid) return res.status(400).json({ error: 'NID is required' });

    try {
        const result = await pool.query(
            `SELECT v.nid, v.name, v.constituency_id
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
            `SELECT DISTINCT
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
                c.id AS constituency_id,
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
 * (Legacy route kept for backward compat)
 */
router.get('/stats', async (req, res) => {
    const { election_id, nid } = req.query;
    if (!election_id || !nid) return res.status(400).json({ error: 'Election ID and NID are required' });

    try {
        const coeRes = await pool.query(
            `SELECT coe.id AS coe_id, c.name, c.id AS constituency_id, coe.election_id
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
 * GET /api/voter-portal/election-results/:electionId/:constituencyId
 * Returns constituency-scoped results for a finalized election.
 * Used for "My Constituency" view in voter dashboard.
 */
router.get('/election-results/:electionId/:constituencyId', async (req, res) => {
    const { electionId, constituencyId } = req.params;

    try {
        // Find the constituency_of_election record
        const coeRes = await pool.query(
            `SELECT coe.id AS coe_id, c.name AS constituency_name
             FROM constituency_of_election coe
             JOIN constituency c ON c.id = coe.constituency_id
             WHERE coe.election_id = $1 AND coe.constituency_id = $2`,
            [electionId, constituencyId]
        );

        if (coeRes.rows.length === 0) {
            return res.status(404).json({ error: 'Constituency not found for this election' });
        }

        const { coe_id, constituency_name } = coeRes.rows[0];

        // Summary stats
        const statsRes = await pool.query(
            `SELECT
                (SELECT COUNT(*) FROM voter_of_election voe
                 JOIN voter v ON v.nid = voe.nid
                 WHERE voe.election_id = $1 AND v.constituency_id = $2) AS total_voters,
                COUNT(vl.voter_token) AS votes_cast
             FROM voting_log vl
             WHERE vl.constituency_of_election_id = $3`,
            [electionId, constituencyId, coe_id]
        );

        const summary = statsRes.rows[0] || { total_voters: 0, votes_cast: 0 };

        // Ranked candidates
        const candidatesRes = await pool.query(
            `SELECT
                ca.candidate_id,
                ca.name,
                ca.party,
                COUNT(vl.voter_token) AS votes
             FROM candidate ca
             LEFT JOIN voting_log vl
                ON vl.candidate_id = ca.candidate_id
                AND vl.constituency_of_election_id = $1
             WHERE ca.constituency_of_election_id = $1
             GROUP BY ca.candidate_id, ca.name, ca.party
             ORDER BY votes DESC`,
            [coe_id]
        );

        const candidates = candidatesRes.rows.map(c => ({
            ...c,
            votes: parseInt(c.votes)
        }));

        const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
        const rankedCandidates = candidates.map((c, idx) => ({
            rank: idx + 1,
            name: c.name,
            party: c.party,
            votes: c.votes,
            percentage: totalVotes > 0 ? Math.round((c.votes / totalVotes) * 1000) / 10 : 0
        }));

        res.json({
            constituency_name,
            summary: {
                total_voters: parseInt(summary.total_voters),
                votes_cast: parseInt(summary.votes_cast),
                turnout: parseInt(summary.total_voters) > 0
                    ? Math.round((parseInt(summary.votes_cast) / parseInt(summary.total_voters)) * 1000) / 10
                    : 0
            },
            candidates: rankedCandidates
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching constituency results' });
    }
});

/**
 * GET /api/voter-portal/election-results-overall/:electionId
 * Returns overall election results across all constituencies (party seats view).
 * Used for "Overall Results" view in voter dashboard.
 */
router.get('/election-results-overall/:electionId', async (req, res) => {
    const { electionId } = req.params;

    try {
        // Total voters for this election
        const totalVotersRes = await pool.query(
            `SELECT COUNT(DISTINCT voe.nid) AS total_voters
             FROM voter_of_election voe
             WHERE voe.election_id = $1`,
            [electionId]
        );

        // Total votes cast
        const totalVotesRes = await pool.query(
            `SELECT COUNT(vl.voter_token) AS votes_cast
             FROM voting_log vl
             JOIN constituency_of_election coe ON coe.id = vl.constituency_of_election_id
             WHERE coe.election_id = $1`,
            [electionId]
        );

        const totalVoters = parseInt(totalVotersRes.rows[0]?.total_voters || 0);
        const votesCast = parseInt(totalVotesRes.rows[0]?.votes_cast || 0);

        // Party seats (number of constituencies won per party)
        const partySeatsRes = await pool.query(
            `SELECT party_name, COUNT(*) AS seat_count
             FROM (
                SELECT DISTINCT ON (ranked.coe_id)
                    ranked.coe_id,
                    ranked.party AS party_name
                FROM (
                    SELECT
                        ca.candidate_id,
                        ca.party,
                        coe.id AS coe_id,
                        COUNT(vl.voter_token) AS vote_count
                    FROM constituency_of_election coe
                    JOIN candidate ca ON ca.constituency_of_election_id = coe.id
                    LEFT JOIN voting_log vl ON vl.candidate_id = ca.candidate_id
                        AND vl.constituency_of_election_id = coe.id
                    WHERE coe.election_id = $1
                    GROUP BY ca.candidate_id, ca.party, coe.id
                ) ranked
                ORDER BY ranked.coe_id, ranked.vote_count DESC
             ) winners
             GROUP BY party_name
             ORDER BY seat_count DESC`,
            [electionId]
        );

        // Overall candidate standings (aggregated across all constituencies by party total votes)
        const candidatesRes = await pool.query(
            `SELECT
                ca.party,
                SUM(COALESCE(vote_counts.votes, 0)) AS total_votes
             FROM candidate ca
             JOIN constituency_of_election coe ON coe.id = ca.constituency_of_election_id
             LEFT JOIN (
                SELECT candidate_id, COUNT(voter_token) AS votes
                FROM voting_log
                GROUP BY candidate_id
             ) vote_counts ON vote_counts.candidate_id = ca.candidate_id
             WHERE coe.election_id = $1
             GROUP BY ca.party
             ORDER BY total_votes DESC`,
            [electionId]
        );

        const partyResults = candidatesRes.rows.map(r => ({
            party: r.party,
            votes: parseInt(r.total_votes),
        }));

        const totalPartyVotes = partyResults.reduce((s, r) => s + r.votes, 0);
        const rankedParties = partyResults.map((r, idx) => ({
            rank: idx + 1,
            name: r.party,
            party: r.party,
            votes: r.votes,
            percentage: totalPartyVotes > 0 ? Math.round((r.votes / totalPartyVotes) * 1000) / 10 : 0
        }));

        res.json({
            summary: {
                total_voters: totalVoters,
                votes_cast: votesCast,
                turnout: totalVoters > 0 ? Math.round((votesCast / totalVoters) * 1000) / 10 : 0
            },
            party_seats: partySeatsRes.rows.map(p => ({
                party_name: p.party_name,
                seat_count: parseInt(p.seat_count)
            })),
            parties: rankedParties
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching overall results' });
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
