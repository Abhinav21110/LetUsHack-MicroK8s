import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'letushack_db',
});

export async function getSystemSetting(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const result = await pool.query(
      'SELECT value FROM system_settings WHERE key = $1',
      [key]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].value;
    }
    
    return defaultValue;
  } catch (error) {
    console.error(`Error fetching system setting ${key}:`, error);
    return defaultValue;
  }
}

export async function getLabTimeoutMinutes(): Promise<number> {
  const timeout = await getSystemSetting('lab_timeout_minutes', '60');
  return parseInt(timeout, 10) || 60;
}

export async function getOSTimeoutMinutes(): Promise<number> {
  const timeout = await getSystemSetting('os_timeout_minutes', '60');
  return parseInt(timeout, 10) || 60;
}
