import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getAuthUser } from '@/lib/auth';
import { k8sService } from '@/lib/k8s-service';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: 'letushack_db',
});

async function isAdmin(request: NextRequest): Promise<boolean> {
  const user = await getAuthUser(request);
  if (!user) return false;

  const result = await pool.query(
    'SELECT role FROM users WHERE user_id = $1',
    [user.user_id]
  );

  return result.rows[0]?.role === 'admin';
}

export async function GET(request: NextRequest) {
  try {
    if (!await isAdmin(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get database stats
    const [usersCount, activeUsersCount, labsCount, activePodsCount] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM users WHERE last_activity > NOW() - INTERVAL \'24 hours\''),
      pool.query('SELECT COUNT(*) FROM labs'),
      pool.query('SELECT COUNT(*) FROM active_k8s_labs'),
    ]);

    const stats = {
      totalUsers: parseInt(usersCount.rows[0].count),
      activeUsers: parseInt(activeUsersCount.rows[0].count),
      totalLabs: parseInt(labsCount.rows[0].count),
      activePods: parseInt(activePodsCount.rows[0].count),
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
