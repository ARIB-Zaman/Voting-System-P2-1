const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM constituency");
    res.json(result.rows);
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post("/", async (req, res) => {
  const { election_id, constituencies } = req.body;

  // Basic validation
  if (!election_id || !Array.isArray(constituencies)) {
    return res.status(400).json({
      error: "election_id and constituencies array are required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const c of constituencies) {
      const { name, region, ro_username } = c;

      if (!name || !region) {
        throw new Error("Constituency name and region are required");
      }

      let ro_id = null;

      // If RO username is provided, resolve it
      if (ro_username) {
        const roResult = await client.query(
          `
          SELECT user_id
          FROM users
          WHERE username = $1 AND role = 'RO'
          `,
          [ro_username]
        );

        if (roResult.rows.length === 0) {
          throw new Error(`Invalid RO username: ${ro_username}`);
        }

        ro_id = roResult.rows[0].user_id;
      }

      // Insert constituency
      await client.query(
        `
        INSERT INTO constituency (name, region, election_id, ro_id)
        VALUES ($1, $2, $3, $4)
        `,
        [name, region, election_id, ro_id]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Constituencies created successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");

    res.status(500).json({
      error: err.message,
    });
  } finally {
    client.release();
  }
});


module.exports = router;