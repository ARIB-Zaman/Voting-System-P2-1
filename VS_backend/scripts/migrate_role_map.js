const pool = require('./db');

async function migrate() {
  try {
    console.log('Checking for duplicates in role_map...');
    const dups = await pool.query(`
      SELECT election_id, user_id, COUNT(*) 
      FROM role_map 
      GROUP BY election_id, user_id 
      HAVING COUNT(*) > 1
    `);

    if (dups.rows.length > 0) {
      console.warn('Duplicates found! Please resolve them before adding the unique constraint.');
      console.table(dups.rows);
      return;
    }

    console.log('No duplicates found. Adding unique constraint...');
    await pool.query(`
      ALTER TABLE role_map 
      ADD CONSTRAINT unique_election_user 
      UNIQUE (election_id, user_id)
    `);
    console.log('Unique constraint added successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
