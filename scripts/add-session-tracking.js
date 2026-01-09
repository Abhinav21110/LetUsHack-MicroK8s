#!/usr/bin/env node

/**
 * Add Session Tracking Migration
 * 
 * Adds session_token column to users table for single-device authentication.
 * Run with: node scripts/add-session-tracking.js
 */

const { Pool } = require('pg');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

async function migrate() {
  console.log('========================================');
  console.log('     Add Session Tracking Migration');
  console.log('========================================\n');
  
  try {
    // Check if column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'session_token'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✓ Column session_token already exists, skipping...\n');
    } else {
      // Add session_token column
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN session_token VARCHAR(255)
      `);
      console.log('✓ Added session_token column to users table\n');
    }
    
    // Show table structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('Current users table structure:');
    console.log('─'.repeat(50));
    result.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('─'.repeat(50));
    
    console.log('\n✓ Migration completed successfully!\n');
    
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
