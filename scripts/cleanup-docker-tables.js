const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

async function cleanupDockerTables() {
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    database: 'letushack_db'
  });

  try {
    console.log('🧹 Starting cleanup of old Docker tables...\n');

    // Check if tables exist and have data
    const containerCheck = await pool.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'active_containers'
    `);

    const osContainerCheck = await pool.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'active_os_containers'
    `);

    if (containerCheck.rows[0].count > 0) {
      const containerData = await pool.query('SELECT COUNT(*) as count FROM active_containers');
      console.log(`📊 Found 'active_containers' table with ${containerData.rows[0].count} records`);
      
      if (containerData.rows[0].count > 0) {
        console.log('⚠️  Table has data. Creating backup before deletion...');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS active_containers_backup_${Date.now()} AS 
          SELECT * FROM active_containers
        `);
        console.log('✅ Backup created');
      }
      
      await pool.query('DROP TABLE IF EXISTS active_containers CASCADE');
      console.log('🗑️  Dropped active_containers table\n');
    } else {
      console.log('ℹ️  active_containers table does not exist\n');
    }

    if (osContainerCheck.rows[0].count > 0) {
      const osData = await pool.query('SELECT COUNT(*) as count FROM active_os_containers');
      console.log(`📊 Found 'active_os_containers' table with ${osData.rows[0].count} records`);
      
      if (osData.rows[0].count > 0) {
        console.log('⚠️  Table has data. Creating backup before deletion...');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS active_os_containers_backup_${Date.now()} AS 
          SELECT * FROM active_os_containers
        `);
        console.log('✅ Backup created');
      }
      
      await pool.query('DROP TABLE IF EXISTS active_os_containers CASCADE');
      console.log('🗑️  Dropped active_os_containers table\n');
    } else {
      console.log('ℹ️  active_os_containers table does not exist\n');
    }

    console.log('✅ Cleanup complete!');
    console.log('\n📝 Summary:');
    console.log('   - Old Docker tables removed');
    console.log('   - Backups created (if tables had data)');
    console.log('   - Database now uses K8s tables only:');
    console.log('     • active_k8s_labs');
    console.log('     • active_k8s_os_containers');

    await pool.end();
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  }
}

cleanupDockerTables().catch(console.error);
