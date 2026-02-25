/**
 * seed.js — run once to migrate BetterAuth tables and seed dummy users.
 * Usage: node seed.js
 */
require('dotenv').config();
const pool = require('./db');
const { auth } = require('./auth');

async function migrate() {
    console.log('Creating BetterAuth tables if not exist...');

    // BetterAuth core tables (PostgreSQL)
    await pool.query(`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      "emailVerified" BOOLEAN NOT NULL DEFAULT false,
      image TEXT,
      role TEXT NOT NULL DEFAULT 'PO',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      token TEXT NOT NULL UNIQUE,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "idToken" TEXT,
      "accessTokenExpiresAt" TIMESTAMPTZ,
      "refreshTokenExpiresAt" TIMESTAMPTZ,
      scope TEXT,
      password TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ,
      "updatedAt" TIMESTAMPTZ
    );
  `);

    // Add approved column (idempotent)
    await pool.query(`
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false;
    `);

    console.log('Tables created (or already exist).');
}

async function seedUsers() {
    console.log('Seeding dummy users via BetterAuth API...');

    const dummyUsers = [
        { email: 'admin@election.dev', password: 'password123', name: 'Admin User', role: 'ADMIN' },
        { email: 'ro@election.dev', password: 'password123', name: 'Returning Officer', role: 'RO' },
        { email: 'po@election.dev', password: 'password123', name: 'Polling Officer', role: 'PO' },
    ];

    for (const u of dummyUsers) {
        // Check if user already exists
        const existing = await pool.query('SELECT id FROM "user" WHERE email = $1', [u.email]);
        if (existing.rows.length > 0) {
            console.log(`  ↳ User ${u.email} already exists, skipping.`);
            continue;
        }

        // Use BetterAuth API to create with hashed password
        try {
            const res = await auth.api.signUpEmail({
                body: { email: u.email, password: u.password, name: u.name },
            });

            if (res && res.user) {
                // Set the role and mark as approved (seed users are pre-approved)
                await pool.query('UPDATE "user" SET role = $1, approved = true WHERE id = $2', [u.role, res.user.id]);
                console.log(`  ✓ Created ${u.email} with role ${u.role} (approved)`);
            }
        } catch (err) {
            console.error(`  ✗ Failed to create ${u.email}:`, err.message || err);
        }
    }
}

(async () => {
    try {
        await migrate();
        await seedUsers();
        // Ensure all seed users are approved even if they existed before
        await pool.query(`UPDATE "user" SET approved = true WHERE email IN ('admin@election.dev', 'ro@election.dev', 'po@election.dev')`);
        console.log('\nDone! Dummy credentials (all approved):');
        console.log('  ADMIN → admin@election.dev / password123');
        console.log('  RO    → ro@election.dev    / password123');
        console.log('  PO    → po@election.dev    / password123');
    } catch (err) {
        console.error('Seed failed:', err);
    } finally {
        await pool.end();
    }
})();
