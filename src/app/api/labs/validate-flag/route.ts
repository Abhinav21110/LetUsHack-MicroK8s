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

const DIFFICULTY_POINTS = {
	easy: 33,
	medium: 33,
	hard: 34,
};

const DIFFICULTY_LEVEL = {
	easy: 1,
	medium: 2,
	hard: 3,
};

export async function POST(req: NextRequest) {
	try {
		const user = await getAuthUser(req);
		if (!user) {
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const { labId, difficulty, flag, podName, namespace } = await req.json();

		if (!labId || !difficulty || !flag) {
			return NextResponse.json(
				{ success: false, error: "Missing required fields" },
				{ status: 400 }
			);
		}

		// Validate difficulty
		if (!['easy', 'medium', 'hard'].includes(difficulty)) {
			return NextResponse.json(
				{ success: false, error: "Invalid difficulty" },
				{ status: 400 }
			);
		}

		const level = DIFFICULTY_LEVEL[difficulty as keyof typeof DIFFICULTY_LEVEL];

		const existingScore = await pool.query(
			`SELECT score, solved FROM lab_scores 
			 WHERE user_id = $1 AND lab_id = $2 AND level = $3`,
			[user.user_id, labId, level]
		);

		if (existingScore.rows.length > 0 && existingScore.rows[0].solved) {
			return NextResponse.json({
				success: true,
				correct: true,
				alreadySolved: true,
				points: existingScore.rows[0].score,
				message: `You already solved this flag! (${existingScore.rows[0].score} points)`,
			});
		}

		// Read flag from K8s pod
		let correctFlag = '';
		if (podName && namespace) {
			try {
				let cmd: string[] = [];
				if (difficulty === 'easy') {
					if (labId === 4) { // Linux Lab
						cmd = ['cat', '/usr/share/nginx/html/uploads/flag_easy.txt'];
					} else {
						cmd = ['cat', '/usr/share/nginx/html/flag_easy.txt'];
					}
				} else if (difficulty === 'medium') {
					if (labId === 4) { // Linux Lab
						cmd = ['sh', '-c', 'cat /usr/share/nginx/html/api/config.json | grep flag_medium | cut -d\\" -f4'];
					} else {
						cmd = ['cat', '/usr/share/nginx/html/flag_medium.txt'];
					}
				} else if (difficulty === 'hard') {
					if (labId === 4) { // Linux Lab
						cmd = ['cat', '/usr/share/nginx/html/uploads/flag_hard.txt'];
					} else {
						cmd = ['cat', '/usr/share/nginx/html/flag_hard.txt'];
					}
				}

				let output = '';
				let errorOutput = '';

				await exec.exec(
					namespace,
					podName,
					'', // container name - empty for default
					cmd,
					process.stdout,
					{
						onData: (data: Buffer) => { output += data.toString(); },
						onError: (data: Buffer) => { errorOutput += data.toString(); }
					} as any,
					process.stdin,
					false
				);

				correctFlag = output.trim();
			} catch (error) {
				console.error('Error executing command in pod:', error);
				return NextResponse.json(
					{ success: false, error: 'Failed to validate flag' },
					{ status: 500 }
				);
			}
		} else {
			// Fallback: validate against environment variable flags if no pod info
			correctFlag = flag.trim(); // Will fail validation if not provided
		}

		const submittedFlag = flag.trim();

		console.log('=== Flag Validation ===');
		console.log('Difficulty:', difficulty);
		console.log('Match:', correctFlag === submittedFlag);

		const isCorrect = correctFlag === submittedFlag;

		if (isCorrect) {
			const points = DIFFICULTY_POINTS[difficulty as keyof typeof DIFFICULTY_POINTS];

			const existingRecord = await pool.query(
				`SELECT score_id FROM lab_scores 
				 WHERE user_id = $1 AND lab_id = $2 AND level = $3`,
				[user.user_id, labId, level]
			);

			if (existingRecord.rows.length > 0) {
				await pool.query(
					`UPDATE lab_scores 
					 SET score = $1, solved = $2, submitted_at = NOW()
					 WHERE user_id = $3 AND lab_id = $4 AND level = $5`,
					[points, true, user.user_id, labId, level]
				);
			} else {
				await pool.query(
					`INSERT INTO lab_scores (user_id, lab_id, level, score, solved, submitted_at)
					 VALUES ($1, $2, $3, $4, $5, NOW())`,
					[user.user_id, labId, level, points, true]
				);
			}

			const allScores = await pool.query(
				`SELECT SUM(score) as total_score, COUNT(*) as solved_count 
				 FROM lab_scores 
				 WHERE user_id = $1 AND lab_id = $2 AND solved = true`,
				[user.user_id, labId]
			);

			const totalScore = parseInt(allScores.rows[0]?.total_score || '0');
			const solvedCount = parseInt(allScores.rows[0]?.solved_count || '0');

			return NextResponse.json({
				success: true,
				correct: true,
				points,
				totalScore,
				solvedCount,
				completed: solvedCount === 3,
				message: `Correct! You earned ${points} points.`,
			});
		} else {
			return NextResponse.json({
				success: true,
				correct: false,
				message: "Incorrect flag. Try again!",
				debug: {
					expected: correctFlag,
					received: submittedFlag
				}
			});
		}
	} catch (error) {
		console.error("Flag validation error:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 }
		);
	}
}

const DIFFICULTY_POINTS = {
	easy: 33,
	medium: 33,
	hard: 34,
};

const DIFFICULTY_LEVEL = {
	easy: 1,
	medium: 2,
	hard: 3,
};

export async function POST(req: NextRequest) {
	try {
		const user = await getAuthUser(req);
		if (!user) {
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const { labId, difficulty, flag, containerId } = await req.json();

		if (!labId || !difficulty || !flag || !containerId) {
			return NextResponse.json(
				{ success: false, error: "Missing required fields" },
				{ status: 400 }
			);
		}

		// Validate difficulty
		if (!['easy', 'medium', 'hard'].includes(difficulty)) {
			return NextResponse.json(
				{ success: false, error: "Invalid difficulty" },
				{ status: 400 }
			);
		}

		const level = DIFFICULTY_LEVEL[difficulty as keyof typeof DIFFICULTY_LEVEL];
		
		const existingScore = await pool.query(
			`SELECT score, solved FROM lab_scores 
			 WHERE user_id = $1 AND lab_id = $2 AND level = $3`,
			[user.user_id, labId, level]
		);

		if (existingScore.rows.length > 0 && existingScore.rows[0].solved) {
			return NextResponse.json({
				success: true,
				correct: true,
				alreadySolved: true,
				points: existingScore.rows[0].score,
				message: `You already solved this flag! (${existingScore.rows[0].score} points)`,
			});
		}

		const container = docker.getContainer(containerId);
		
		try {
			let cmd: string[] = [];
			
			if (difficulty === 'easy') {
				cmd = ['cat', '/usr/share/nginx/html/uploads/flag_easy.txt'];
			} else if (difficulty === 'medium') {
				cmd = ['sh', '-c', 'cat /usr/share/nginx/html/api/config.json | grep flag_medium | cut -d\\" -f4'];
			} else if (difficulty === 'hard') {
				cmd = ['cat', '/usr/share/nginx/html/uploads/flag_hard.txt'];
			}

			const exec = await container.exec({
				Cmd: cmd,
				AttachStdout: true,
				AttachStderr: true,
			});

			const stream = await exec.start({ hijack: true, stdin: false });
			
			let output = '';
			
			await new Promise<void>((resolve, reject) => {
				stream.on('data', (chunk: Buffer) => {
					let startIndex = 0;
					if (chunk.length > 8 && chunk[0] <= 2) {
						startIndex = 8;
					}
					
					const data = chunk.toString('utf8', startIndex);
					output += data;
				});
				
				stream.on('end', () => resolve());
				stream.on('error', (err) => reject(err));
			});

			const correctFlag = output.trim();
			const submittedFlag = flag.trim();

			console.log('=== Flag Validation ===');
			console.log('Difficulty:', difficulty);
			console.log('Match:', correctFlag === submittedFlag);

			const isCorrect = correctFlag === submittedFlag;

			if (isCorrect) {
				const points = DIFFICULTY_POINTS[difficulty as keyof typeof DIFFICULTY_POINTS];
				
				const existingRecord = await pool.query(
					`SELECT score_id FROM lab_scores 
					 WHERE user_id = $1 AND lab_id = $2 AND level = $3`,
					[user.user_id, labId, level]
				);

				if (existingRecord.rows.length > 0) {
					await pool.query(
						`UPDATE lab_scores 
						 SET score = $1, solved = $2, submitted_at = NOW()
						 WHERE user_id = $3 AND lab_id = $4 AND level = $5`,
						[points, true, user.user_id, labId, level]
					);
				} else {
					await pool.query(
						`INSERT INTO lab_scores (user_id, lab_id, level, score, solved, submitted_at)
						 VALUES ($1, $2, $3, $4, $5, NOW())`,
						[user.user_id, labId, level, points, true]
					);
				}

				const allScores = await pool.query(
					`SELECT SUM(score) as total_score, COUNT(*) as solved_count 
					 FROM lab_scores 
					 WHERE user_id = $1 AND lab_id = $2 AND solved = true`,
					[user.user_id, labId]
				);

				const totalScore = parseInt(allScores.rows[0]?.total_score || '0');
				const solvedCount = parseInt(allScores.rows[0]?.solved_count || '0');
				
				return NextResponse.json({
					success: true,
					correct: true,
					points,
					totalScore,
					solvedCount,
					completed: solvedCount === 3,
					message: `Correct! You earned ${points} points.`,
				});
			} else {
				return NextResponse.json({
					success: true,
					correct: false,
					message: "Incorrect flag. Try again!",
					debug: {
						expected: correctFlag,
						received: submittedFlag
					}
				});
			}
		} catch (execError) {
			console.error('Error reading flag from container:', execError);
			return NextResponse.json(
				{
					success: false,
					error: "Could not read flag from container. Make sure the lab is running.",
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error("Flag validation error:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 }
		);
	}
}
