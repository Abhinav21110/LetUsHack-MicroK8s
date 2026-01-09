import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getAuthUser } from '@/lib/auth';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'letushack_db',
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    
    if (!user) {
      return NextResponse.json({
        error: true,
        message: 'Unauthorized'
      }, { status: 401 });
    }

    const body = await req.json();
    const { xl1, xl2, xl3, xl4, xl5, cl1, cl2, cl3, cl4, cl5 } = body;

    // Get current points before update
    const currentPoints = await pool.query(`
      SELECT xl1, xl2, xl3, xl4, xl5, cl1, cl2, cl3, cl4, cl5
      FROM points
      WHERE user_id = $1
    `, [user.user_id]);

    const oldTotal = currentPoints.rows[0] 
      ? Object.values(currentPoints.rows[0]).reduce((sum: number, val: any) => sum + (val || 0), 0)
      : 0;

    // Update points
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    const pointsMap: { [key: string]: number | undefined } = { xl1, xl2, xl3, xl4, xl5, cl1, cl2, cl3, cl4, cl5 };
    
    for (const [key, value] of Object.entries(pointsMap)) {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramIndex++}`);
        updateValues.push(value);
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({
        error: true,
        message: 'No points to update'
      }, { status: 400 });
    }

    updateValues.push(user.user_id);

    await pool.query(`
      UPDATE points
      SET ${updateFields.join(', ')}
      WHERE user_id = $${paramIndex}
    `, updateValues);

    // Get updated points and calculate new total
    const updatedPoints = await pool.query(`
      SELECT xl1, xl2, xl3, xl4, xl5, cl1, cl2, cl3, cl4, cl5
      FROM points
      WHERE user_id = $1
    `, [user.user_id]);

    const newTotal = Object.values(updatedPoints.rows[0]).reduce((sum: number, val: any) => sum + (val || 0), 0);

    // Get current rank
    const rankResult = await pool.query(`
      SELECT COUNT(*) + 1 as rank
      FROM (
        SELECT 
          u.user_id,
          COALESCE(p.xl1, 0) + COALESCE(p.xl2, 0) + COALESCE(p.xl3, 0) + 
          COALESCE(p.xl4, 0) + COALESCE(p.xl5, 0) + COALESCE(p.cl1, 0) + 
          COALESCE(p.cl2, 0) + COALESCE(p.cl3, 0) + COALESCE(p.cl4, 0) + 
          COALESCE(p.cl5, 0) as total_score
        FROM users u
        LEFT JOIN points p ON u.user_id = p.user_id
      ) leaderboard
      WHERE total_score > $1
    `, [newTotal]);

    const newRank = rankResult.rows[0].rank;

    // Create notification if points increased
    if (newTotal > oldTotal) {
      const message = `🎉 Your total score increased to ${newTotal}! Your new rank is #${newRank}.`;
      
      await pool.query(`
        INSERT INTO notifications (user_id, message, type, is_read)
        VALUES ($1, $2, $3, false)
      `, [user.user_id, message, 'success']);

      console.log('[NOTIFICATION_CREATED]', {
        user: user.user_id,
        oldTotal,
        newTotal,
        rank: newRank,
        at: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Points updated successfully',
      data: {
        old_total: oldTotal,
        new_total: newTotal,
        rank: newRank,
        points: updatedPoints.rows[0]
      }
    }, { status: 200 });
  } catch (err: any) {
    console.error('[POINTS_UPDATE_ERROR]', err);
    return NextResponse.json({
      error: true,
      message: 'Failed to update points',
      details: err.message
    }, { status: 500 });
  }
}
