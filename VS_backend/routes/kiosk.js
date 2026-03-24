const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * POST /api/kiosk/verify-otp
 * Verify a voter OTP using the DB function verify_voter_otp(booth_id, otp).
 * Body: { booth_id, otp }
 * Returns: { valid: true, voter_of_election_id } | { valid: false, message }
 */
router.post('/verify-otp', async (req, res) => {
  const { booth_id, otp } = req.body;
  if (!booth_id || !otp) {
    return res.status(400).json({ error: 'booth_id and otp are required' });
  }

  try {
    // Call the DB function
    const result = await pool.query(
      `SELECT verify_voter_otp($1, $2) AS valid`,
      [booth_id, otp]
    );
    const valid = result.rows[0]?.valid;

    if (!valid) {
      return res.json({ valid: false, message: 'Invalid or expired OTP' });
    }

    // OTP is valid — look up the voter_of_election_id from voter_otp table
    const voterRow = await pool.query(
      `SELECT vo.voter_of_election_id
       FROM voter_otp vo
       JOIN voter_of_election voe ON voe.id = vo.voter_of_election_id
       WHERE vo.otp_value = $1
         AND voe.booth_id = $2
       LIMIT 1`,
      [otp, booth_id]
    );

    if (voterRow.rows.length === 0) {
      return res.json({ valid: false, message: 'Voter record not found' });
    }

    const { voter_of_election_id } = voterRow.rows[0];
    return res.json({ valid: true, voter_of_election_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: booth_id });
  }
});

/**
 * GET /api/kiosk/candidates?election_id=&constituency_id=
 * Fetch APPROVED candidates for a constituency in an election.
 */
router.get('/candidates', async (req, res) => {
  const { election_id, constituency_id } = req.query;
  if (!election_id || !constituency_id) {
    return res.status(400).json({ error: 'election_id and constituency_id are required' });
  }

  try {
    const result = await pool.query(
      `SELECT c.candidate_id, c.name, c.party, coe.id AS coe_id
       FROM candidate c
       JOIN constituency_of_election coe ON coe.id = c.constituency_of_election_id
       WHERE coe.election_id = $1
         AND coe.constituency_id = $2
         AND c.nomination_status = 'APPROVED'
       ORDER BY c.name ASC`,
      [election_id, constituency_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching candidates' });
  }
});

/**
 * POST /api/kiosk/vote
 * Submit a vote. Generates a voter token and inserts into voting_log.
 * Body: { voter_of_election_id, candidate_id, election_id, constituency_id }
 * Returns: { token }
 */
router.post('/vote', async (req, res) => {
  const { voter_of_election_id, candidate_id, election_id, constituency_id } = req.body;
  if (!voter_of_election_id || !candidate_id || !election_id || !constituency_id) {
    return res.status(400).json({ error: 'voter_of_election_id, candidate_id, election_id, and constituency_id are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Look up constituency_of_election_id (coe_id)
    const coeResult = await client.query(
      `SELECT id AS coe_id
       FROM constituency_of_election
       WHERE election_id = $1 AND constituency_id = $2
       LIMIT 1`,
      [election_id, constituency_id]
    );
    if (coeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Constituency of election not found' });
    }
    const { coe_id } = coeResult.rows[0];

    // Generate voter token using the DB function
    const tokenResult = await client.query(
      `SELECT generate_voter_token($1) AS token`,
      [voter_of_election_id]
    );
    const token = tokenResult.rows[0]?.token;
    if (!token) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Token generation failed' });
    }

    // Record the vote in voting_log
    await client.query(
      `INSERT INTO voting_log (voter_token, constituency_of_election_id, candidate_id)
       VALUES ($1, $2, $3)`,
      [token, coe_id, candidate_id]
    );

    await client.query('COMMIT');
    res.json({ token });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error recording vote' });
  } finally {
    client.release();
  }
});

module.exports = router;
