import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import * as k8s from '@kubernetes/client-node';
import { Pool } from "pg";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const exec = new k8s.Exec(kc);

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || "letushack_db",
});

const DIFFICULTY_POINTS = { easy: 33, medium: 33, hard: 34 } as const;
const DIFFICULTY_LEVEL = { easy: 1, medium: 2, hard: 3 } as const;

async function readFlag(podName: string, namespace: string, difficulty: "easy"|"medium"|"hard") {
  let cmd: string[] = [];
  if (difficulty === 'easy') cmd = ['cat', `/home/debian/lf_easy.txt`];
  if (difficulty === 'medium') cmd = ['cat', `/opt/lf/lf_medium.txt`];
  if (difficulty === 'hard') cmd = ['cat', `/var/tmp/.lf_hard.txt`];

  let output = '';
  await exec.exec(
    namespace,
    podName,
    '', // default container
    cmd,
    process.stdout,
    {
      onData: (data: Buffer) => { output += data.toString(); },
      onError: (data: Buffer) => { /* ignore stderr */ }
    } as any,
    process.stdin,
    false
  );
  return output.trim();
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { labId, difficulty, flag, podName, namespace } = await req.json();
    if (!labId || !difficulty || !flag) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (!['easy','medium','hard'].includes(difficulty)) {
      return NextResponse.json({ success: false, error: 'Invalid difficulty' }, { status: 400 });
    }

    const level = (DIFFICULTY_LEVEL as any)[difficulty];

    // If already solved, short-circuit
    const existing = await pool.query(
      `SELECT score, solved FROM lab_scores WHERE user_id=$1 AND lab_id=$2 AND level=$3`,
      [user.user_id, labId, level]
    );
    if (existing.rows.length && existing.rows[0].solved) {
      return NextResponse.json({ success: true, correct: true, alreadySolved: true, points: existing.rows[0].score });
    }

    // Read authoritative flag from running Linux Fundamentals pod
    let expected = '';
    if (podName && namespace) {
      try {
        expected = await readFlag(podName, namespace, difficulty);
      } catch (error) {
        console.error('Error reading flag from pod:', error);
        return NextResponse.json({ success: false, error: 'Failed to validate flag' }, { status: 500 });
      }
    }
    
    const submitted = String(flag || '').trim();
    const correct = expected === submitted;

    if (!correct) {
      return NextResponse.json({ success: true, correct: false, message: 'Incorrect flag. Keep trying!' });
    }

    const points = (DIFFICULTY_POINTS as any)[difficulty];
    const exists = await pool.query(
      `SELECT score_id FROM lab_scores WHERE user_id=$1 AND lab_id=$2 AND level=$3`,
      [user.user_id, labId, level]
    );
    if (exists.rows.length) {
      await pool.query(
        `UPDATE lab_scores SET score=$1, solved=$2, submitted_at=NOW() WHERE user_id=$3 AND lab_id=$4 AND level=$5`,
        [points, true, user.user_id, labId, level]
      );
    } else {
      await pool.query(
        `INSERT INTO lab_scores (user_id, lab_id, level, score, solved, submitted_at) VALUES ($1,$2,$3,$4,$5,NOW())`,
        [user.user_id, labId, level, points, true]
      );
    }

    const totals = await pool.query(
      `SELECT COALESCE(SUM(score),0) as total_score, COUNT(*) as solved_count FROM lab_scores WHERE user_id=$1 AND lab_id=$2 AND solved=true`,
      [user.user_id, labId]
    );

    return NextResponse.json({
      success: true,
      correct: true,
      points,
      totalScore: parseInt(totals.rows[0]?.total_score || '0'),
      solvedCount: parseInt(totals.rows[0]?.solved_count || '0'),
      completed: parseInt(totals.rows[0]?.solved_count || '0') === 3,
    });
  } catch (e) {
    console.error('[LINUX_VALIDATE_ERROR]', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
