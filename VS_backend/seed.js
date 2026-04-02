/**
 * seed.js — seeds admin + two worker accounts into the new users table.
 * Run AFTER migrate.js:  node seed.js
 *
 * Uses bcryptjs directly — no Better Auth dependency.
 */
require('dotenv').config();
const pool = require('./db');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

const dummyUsers = [
    {
        name: 'Admin User',
        email: 'admin@election.dev',
        password: 'password123',
        role: 'ADMIN',
        approved: true,
    },
    {
        name: 'Returning Officer',
        email: 'ro@election.dev',
        password: 'password123',
        role: 'USER',
        approved: true,
    },
    {
        name: 'Polling Officer',
        email: 'po@election.dev',
        password: 'password123',
        role: 'USER',
        approved: true,
    },
];

async function seed() {
    console.log('Seeding users...');

    for (const u of dummyUsers) {
        // Check if user already exists
        const existing = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [u.email]
        );

        if (existing.rows.length > 0) {
            console.log(`  ↳ ${u.email} already exists — skipping.`);
            continue;
        }

        const hashed = await bcrypt.hash(u.password, SALT_ROUNDS);

        await pool.query(
            `INSERT INTO users (name, email, password, role, approved)
             VALUES ($1, $2, $3, $4, $5)`,
            [u.name, u.email, hashed, u.role, u.approved]
        );

        console.log(`  ✓ Created ${u.email} (role: ${u.role}, approved: ${u.approved})`);
    }

    console.log('\nDone! Dummy credentials (all approved):');
    console.log('  ADMIN  → admin@election.dev / password123');
    console.log('  Worker → ro@election.dev    / password123');
    console.log('  Worker → po@election.dev    / password123');
}

seed()
    .catch((err) => {
        console.error('Seed failed:', err);
        process.exit(1);
    })
    .finally(() => pool.end());
