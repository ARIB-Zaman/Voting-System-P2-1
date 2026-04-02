/**
 * migrate.js — drops Better Auth tables, creates clean users table,
 * alters role_map.user_id to INTEGER.
 * Run once: node migrate.js
 */
require('dotenv').config();
const pool = require('./db');

async function run() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('1. Dropping Better Auth tables...');
        await client.query(`DROP TABLE IF EXISTS verification CASCADE`);
        await client.query(`DROP TABLE IF EXISTS session CASCADE`);
        await client.query(`DROP TABLE IF EXISTS account CASCADE`);
        // Drop the old BA "user" table — cascades FK constraints
        await client.query(`DROP TABLE IF EXISTS "user" CASCADE`);
        console.log('   ✓ BA tables dropped');

        console.log('2. Creating clean users table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id         SERIAL PRIMARY KEY,
                name       TEXT NOT NULL,
                email      TEXT NOT NULL UNIQUE,
                password   TEXT NOT NULL,
                role       TEXT NOT NULL DEFAULT 'USER'
                               CHECK (role IN ('ADMIN', 'USER')),
                approved   BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        console.log('   ✓ users table created');

        console.log('3. Altering role_map.user_id TEXT → INTEGER...');
        // Clear any stale rows (they referenced old text IDs)
        await client.query(`DELETE FROM role_map`);
        // Drop old user_id column (FK was cascade-dropped with "user" table)
        await client.query(`ALTER TABLE role_map DROP COLUMN IF EXISTS user_id`);
        // Add new INTEGER column with FK
        await client.query(`
            ALTER TABLE role_map
            ADD COLUMN user_id INTEGER NOT NULL
                REFERENCES users(id) ON DELETE CASCADE
        `);
        console.log('   ✓ role_map.user_id is now INTEGER');

        await client.query('COMMIT');
        console.log('\nMigration complete.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch(() => process.exit(1));
