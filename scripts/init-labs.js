#!/usr/bin/env node

/**
 * Init Labs Script
 *
 * Adds two labs (XSS and CSRF) to the `labs` table if they do not already exist.
 * Run with: node scripts/init-labs.js
 */

const { Pool } = require('pg');
const path = require('path');

// Load environment variables from repo root (.env.local)
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'letushack_db',
});

const labs = [
    {
        lab_name: 'XSS',
        lab_description: 'Cross-Site Scripting challenge: identify and exploit reflected and stored XSS vectors.',
        lab_tags: ['xss', 'injection', 'client'],
        level: 1,
        max_score: 100,
    },
    {
        lab_name: 'CSRF',
        lab_description: 'Cross-Site Request Forgery challenge: explore CSRF protections and bypass techniques.',
        lab_tags: ['csrf', 'auth', 'web'],
        level: 1,
        max_score: 100,
    },
    {
        lab_name: 'Nmap Reconnaissance',
        lab_description: 'Network reconnaissance and enumeration challenge: use nmap and enumeration techniques to discover hidden flags in the FoodNow web application.',
        lab_tags: ['nmap', 'reconnaissance', 'enumeration', 'network'],
        level: 2,
        max_score: 100,
    },
    {
            lab_name: 'Linux Fundamentals',
            lab_description: 'Learn basic Linux commands inside a Pwnbox and find three flags across the filesystem.',
            lab_tags: ['linux', 'fundamentals', 'terminal', 'pwnbox'],
            level: 1,
            max_score: 100,
    },
];

async function ensureLabsTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS labs (
      lab_id SERIAL PRIMARY KEY,
      lab_name VARCHAR(255) NOT NULL,
      lab_description TEXT,
      lab_tags TEXT[],
      level INT,
      max_score INT,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function insertLabs() {
    console.log('Initializing labs...');
    try {
        await ensureLabsTable();

        for (const lab of labs) {
            const res = await pool.query('SELECT lab_id FROM labs WHERE lab_name = $1', [lab.lab_name]);
            if (res.rows.length > 0) {
                console.log(`⚠ Lab '${lab.lab_name}' already exists (lab_id=${res.rows[0].lab_id}), skipping.`);
                continue;
            }

            await pool.query(
                `INSERT INTO labs (lab_name, lab_description, lab_tags, level, max_score)
         VALUES ($1, $2, $3, $4, $5)`,
                [lab.lab_name, lab.lab_description, lab.lab_tags, lab.level, lab.max_score]
            );

            console.log(`✓ Created lab: ${lab.lab_name}`);
        }

        console.log('\nAll labs processed.');
    } catch (err) {
        console.error('Error initializing labs:', err.message || err);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    insertLabs().catch((e) => {
        console.error('Unexpected error:', e);
        process.exit(1);
    });
}
