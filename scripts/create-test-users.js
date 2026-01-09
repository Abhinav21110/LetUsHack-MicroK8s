#!/usr/bin/env node

/**
 * Create Test Users Script
 * 
 * Creates 5 test users in the database with predefined credentials.
 * Run with: node scripts/create-test-users.js
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Database connection
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

// Test user credentials
const testUsers = [
  {
    user_id: 'ngogte',
    password: 'TestPass123!',
    name: 'Neil Gogte',
  },
  {
    user_id: 'test_user1',
    password: 'TestPass123!',
    name: 'Alice Johnson',
  },
  {
    user_id: 'test_user2',
    password: 'TestPass456!',
    name: 'Bob Smith',
  },
  {
    user_id: 'test_user3',
    password: 'TestPass789!',
    name: 'Charlie Brown',
  },
  {
    user_id: 'test_user4',
    password: 'TestPass321!',
    name: 'Diana Prince',
  },
  {
    user_id: 'test_user5',
    password: 'TestPass654!',
    name: 'Ethan Hunt',
  },

];

async function ensureTables() {
  console.log('Ensuring database tables exist...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      ip_address VARCHAR(255),
      last_activity TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      name VARCHAR(255),
      session_token VARCHAR(255)
    );
  `);
  // Ensure session_token column exists for older databases
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'session_token'
      ) THEN
        ALTER TABLE users ADD COLUMN session_token VARCHAR(255);
      END IF;
    END$$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS points (
      user_id VARCHAR(50) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
      xl1 INT DEFAULT 0,
      xl2 INT DEFAULT 0,
      xl3 INT DEFAULT 0,
      xl4 INT DEFAULT 0,
      xl5 INT DEFAULT 0,
      cl1 INT DEFAULT 0,
      cl2 INT DEFAULT 0,
      cl3 INT DEFAULT 0,
      cl4 INT DEFAULT 0,
      cl5 INT DEFAULT 0
    );
  `);

  console.log('✓ Tables ensured');
}

async function createTestUsers() {
  console.log('\nCreating test users...\n');

  const saltRounds = 12;
  const createdUsers = [];

  for (const user of testUsers) {
    try {
      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT user_id FROM users WHERE user_id = $1',
        [user.user_id]
      );

      if (existingUser.rows.length > 0) {
        console.log(`⚠ User ${user.user_id} already exists, skipping...`);
        createdUsers.push({
          ...user,
          status: 'existing',
        });
        continue;
      }

      // Hash password
      const password_hash = await bcrypt.hash(user.password, saltRounds);

      // Insert user
      await pool.query(
        `INSERT INTO users (user_id, password_hash, name, ip_address, last_activity)
         VALUES ($1, $2, $3, $4, NOW())`,
        [user.user_id, password_hash, user.name, process.env.DEFAULT_IP_ADDRESS || '0.0.0.0']
      );

      // Create points entry
      await pool.query(
        `INSERT INTO points (user_id, xl1, xl2, xl3, xl4, xl5, cl1, cl2, cl3, cl4, cl5)
         VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.user_id]
      );

      console.log(`✓ Created user: ${user.user_id} (${user.name})`);
      createdUsers.push({
        ...user,
        status: 'created',
      });

    } catch (error) {
      console.error(`✗ Error creating user ${user.user_id}:`, error.message);
      createdUsers.push({
        ...user,
        status: 'error',
        error: error.message,
      });
    }
  }

  return createdUsers;
}

async function saveCredentials(users) {
  const credentialsPath = path.join(__dirname, '..', 'test-users-credentials.txt');

  let content = `# Test User Credentials
# Generated: ${new Date().toISOString()}
# DO NOT COMMIT THIS FILE TO VERSION CONTROL
# Add to .gitignore if not already present

===========================================
TEST USER CREDENTIALS
===========================================

`;

  users.forEach((user, index) => {
    content += `\n${index + 1}. ${user.name}\n`;
    content += `   User ID:  ${user.user_id}\n`;
    content += `   Password: ${user.password}\n`;
    content += `   Status:   ${user.status}\n`;
    if (user.error) {
      content += `   Error:    ${user.error}\n`;
    }
    content += `   ---\n`;
  });

  content += `\n===========================================
LOGIN INSTRUCTIONS
===========================================

1. Navigate to: http://localhost:3000/login
2. Enter any User ID from above
3. Enter the corresponding Password
4. Click "Login"

===========================================
DATABASE INFO
===========================================

Database: ${process.env.PGDATABASE || 'letushack_db'}
Host:     ${process.env.PGHOST || 'localhost'}
Port:     ${process.env.PGPORT || '5432'}

All users have been created with:
- Zero points in all categories
- IP address: ${process.env.DEFAULT_IP_ADDRESS || '0.0.0.0'}
- Timestamps: Current time

===========================================
`;

  fs.writeFileSync(credentialsPath, content);
  console.log(`\n✓ Credentials saved to: ${credentialsPath}`);
}

async function updateGitignore() {
  const gitignorePath = path.join(__dirname, '..', '.gitignore');

  try {
    let gitignoreContent = '';
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    }

    if (!gitignoreContent.includes('test-users-credentials.txt')) {
      gitignoreContent += '\n# Test user credentials\ntest-users-credentials.txt\n';
      fs.writeFileSync(gitignorePath, gitignoreContent);
      console.log('✓ Added test-users-credentials.txt to .gitignore');
    }
  } catch (error) {
    console.warn('⚠ Could not update .gitignore:', error.message);
  }
}

async function main() {
  console.log('========================================');
  console.log('     Create Test Users Script');
  console.log('========================================\n');

  try {
    await ensureTables();
    const users = await createTestUsers();
    await saveCredentials(users);
    await updateGitignore();

    console.log('\n========================================');
    console.log('     ✓ Test Users Created Successfully');
    console.log('========================================\n');

    const created = users.filter(u => u.status === 'created').length;
    const existing = users.filter(u => u.status === 'existing').length;
    const errors = users.filter(u => u.status === 'error').length;

    console.log(`Created:  ${created}`);
    console.log(`Existing: ${existing}`);
    console.log(`Errors:   ${errors}`);
    console.log('\nCredentials file: test-users-credentials.txt\n');

  } catch (error) {
    console.error('\n✗ Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
