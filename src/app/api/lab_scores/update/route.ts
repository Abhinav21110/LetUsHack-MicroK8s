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

// Helper function to get user's current rank
async function getUserRank(userId: string): Promise<number> {
  const rankResult = await pool.query(`
    SELECT rank FROM (
      SELECT 
        u.user_id,
        ROW_NUMBER() OVER (
          ORDER BY COALESCE(SUM(ls.score), 0) DESC, 
                   COUNT(CASE WHEN ls.solved = TRUE THEN 1 END) DESC, 
                   u.name ASC
        ) as rank
      FROM users u
      LEFT JOIN lab_scores ls ON u.user_id = ls.user_id
      GROUP BY u.user_id, u.name
    ) ranked
    WHERE user_id = $1
  `, [userId]);
  
  return rankResult.rows[0]?.rank || 0;
}

// Helper function to create notification
async function createNotification(userId: string, message: string, type: string = 'info') {
  await pool.query(`
    INSERT INTO notifications (user_id, message, type, is_read)
    VALUES ($1, $2, $3, false)
  `, [userId, message, type]);
  
  console.log('[NOTIFICATION_CREATED]', {
    user: userId,
    message,
    type,
    at: new Date().toISOString()
  });
}

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
    const { lab_id, score, solved } = body;

    if (!lab_id || score === undefined) {
      return NextResponse.json({
        error: true,
        message: 'Missing required fields: lab_id and score'
      }, { status: 400 });
    }

    // Get user's current rank BEFORE update
    const oldRank = await getUserRank(user.user_id);

    // Get current score for this lab (if exists)
    const currentScore = await pool.query(`
      SELECT score, solved FROM lab_scores
      WHERE user_id = $1 AND lab_id = $2
    `, [user.user_id, lab_id]);

    const oldScore = currentScore.rows[0]?.score || 0;
    const wasSolved = currentScore.rows[0]?.solved || false;

    // Update or insert lab score
    await pool.query(`
      INSERT INTO lab_scores (user_id, lab_id, score, solved, submitted_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, lab_id) 
      DO UPDATE SET 
        score = $3,
        solved = $4,
        submitted_at = NOW()
    `, [user.user_id, lab_id, score, solved || false]);

    // Get user's NEW rank AFTER update
    const newRank = await getUserRank(user.user_id);

    // Get lab name for notification
    const labResult = await pool.query(`
      SELECT lab_name FROM labs WHERE lab_id = $1
    `, [lab_id]);
    const labName = labResult.rows[0]?.lab_name || `Lab #${lab_id}`;

    // Create notifications based on what changed
    const notifications = [];

    // 1. If challenge was just solved
    if (solved && !wasSolved) {
      const message = `🎉 Congratulations! You solved "${labName}" and earned ${score} points!`;
      await createNotification(user.user_id, message, 'success');
      notifications.push(message);
    }
    // 2. If score improved but not first solve
    else if (score > oldScore) {
      const message = `⬆️ Your score for "${labName}" improved by ${score - oldScore} points!`;
      await createNotification(user.user_id, message, 'info');
      notifications.push(message);
    }

    // 3. Check for rank changes
    if (oldRank !== newRank && oldRank > 0) {
      if (newRank < oldRank) {
        // Rank improved (lower number is better)
        const message = `🔥 Great job! You moved up to Rank #${newRank} on the leaderboard!`;
        await createNotification(user.user_id, message, 'success');
        notifications.push(message);
      } else if (newRank > oldRank) {
        // Rank dropped
        const message = `⚠️ Your leaderboard rank dropped to #${newRank}. Keep going!`;
        await createNotification(user.user_id, message, 'warning');
        notifications.push(message);
      }
    }
    // 4. If this is first score entry and they got a rank
    else if (oldRank === 0 && newRank > 0) {
      const message = `🎊 You're now on the leaderboard at Rank #${newRank}!`;
      await createNotification(user.user_id, message, 'success');
      notifications.push(message);
    }

    // Get updated total score and challenges solved
    const statsResult = await pool.query(`
      SELECT 
        COALESCE(SUM(score), 0) as total_score,
        COUNT(CASE WHEN solved = TRUE THEN 1 END) as challenges_solved
      FROM lab_scores
      WHERE user_id = $1
    `, [user.user_id]);

    const stats = statsResult.rows[0];

    console.log('[LAB_SCORE_UPDATE]', {
      user: user.user_id,
      lab_id,
      oldScore,
      newScore: score,
      oldRank,
      newRank,
      totalScore: stats.total_score,
      challengesSolved: stats.challenges_solved,
      notificationsCreated: notifications.length,
      at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Score updated successfully',
      data: {
        lab_id,
        old_score: oldScore,
        new_score: score,
        old_rank: oldRank,
        new_rank: newRank,
        total_score: parseInt(stats.total_score),
        challenges_solved: parseInt(stats.challenges_solved),
        notifications_created: notifications
      }
    }, { status: 200 });
  } catch (err: any) {
    console.error('[LAB_SCORE_UPDATE_ERROR]', {
      error: err?.message,
      code: err?.code,
      detail: err?.detail,
      stack: err?.stack,
      at: new Date().toISOString()
    });
    return NextResponse.json({
      error: true,
      message: 'Failed to update score',
      details: err.message
    }, { status: 500 });
  }
}
