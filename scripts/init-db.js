const { Pool } = require("pg");
const path = require("path");

// Always load env from repo root (.env.local). Do NOT move this file.
// This makes the script resilient no matter where it's executed from.
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const PGDATABASE = process.env.PGDATABASE || "letushack_db";

async function initializeDatabase() {
	// First, connect to default postgres database to create our database
	const rootPool = new Pool({
		host: process.env.PGHOST || "localhost",
		port: parseInt(process.env.PGPORT || "5432"),
		user: process.env.PGUSER || "postgres",
		password: process.env.PGPASSWORD,
		database: "postgres", // Connect to default database first
	});

	try {
		// Check if database exists
		const { rows } = await rootPool.query(
			`
      SELECT datname FROM pg_database WHERE datname = $1
    `,
			[PGDATABASE]
		);

		if (rows.length === 0) {
			// Disconnect all other clients first
			await rootPool.query(
				`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid();
      `,
				[PGDATABASE]
			);

			// Create the database
			await rootPool.query(`CREATE DATABASE ${PGDATABASE}`);
		}

		console.log("✅ Database checked/created successfully");
		await rootPool.end();

		// Now connect to our database to create tables
		const appPool = new Pool({
			host: process.env.PGHOST || "localhost",
			port: parseInt(process.env.PGPORT || "5432"),
			user: process.env.PGUSER || "postgres",
			password: process.env.PGPASSWORD,
			database: PGDATABASE,
		});

		// Create users table
		await appPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        ip_address VARCHAR(255),
        last_activity TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        name VARCHAR(255)
      );
    `);
		console.log("✅ users table created successfully (or already exists)");

		// Create notifications table
		await appPool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);
		console.log(
			"✅ notifications table created successfully (or already exists)"
		);

		// Create labs table
		await appPool.query(`
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
		console.log("✅ labs table created successfully (or already exists)");

		// Create lab_scores table
		await appPool.query(`
      CREATE TABLE IF NOT EXISTS lab_scores (
        score_id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        lab_id INT NOT NULL,
        score INT DEFAULT 0,
        solved BOOLEAN DEFAULT FALSE,
        submitted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        level INT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (lab_id) REFERENCES labs(lab_id) ON DELETE CASCADE
      );
    `);

		console.log("✅ lab_scores table created successfully (or already exists)");

		// Migration: Add level column if it doesn't exist (for existing databases)
		await appPool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'lab_scores' AND column_name = 'level'
        ) THEN
          ALTER TABLE lab_scores ADD COLUMN level INT DEFAULT 0;
          RAISE NOTICE 'Added level column to lab_scores table';
        END IF;
      END $$;
    `);
		console.log("✅ lab_scores table migrated (level column check)");

		// Create K8s labs tracking table
		await appPool.query(`
      CREATE TABLE IF NOT EXISTS active_k8s_labs (
        pod_name VARCHAR(255) PRIMARY KEY,
        namespace VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        lab_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'running',
        url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
		console.log(
			"✅ active_k8s_labs table created successfully (or already exists)"
		);

		// Create indexes for K8s labs
		await appPool.query(`
      CREATE INDEX IF NOT EXISTS idx_k8s_labs_user_id ON active_k8s_labs(user_id);
      CREATE INDEX IF NOT EXISTS idx_k8s_labs_namespace ON active_k8s_labs(namespace);
    `);
		console.log("✅ K8s labs indexes created");

		// Create K8s OS containers tracking table
		await appPool.query(`
      CREATE TABLE IF NOT EXISTS active_k8s_os_containers (
        pod_name VARCHAR(255) PRIMARY KEY,
        namespace VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        os_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'running',
        url TEXT,
        vnc_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
		console.log(
			"✅ active_k8s_os_containers table created successfully (or already exists)"
		);

		// Create indexes for K8s OS containers
		await appPool.query(`
      CREATE INDEX IF NOT EXISTS idx_k8s_os_user_id ON active_k8s_os_containers(user_id);
      CREATE INDEX IF NOT EXISTS idx_k8s_os_namespace ON active_k8s_os_containers(namespace);
    `);
		console.log("✅ K8s OS containers indexes created");

		console.log("✅ All tables initialized successfully");
		await appPool.end();
	} catch (err) {
		console.error("❌ Database initialization failed:", err);
		process.exit(1);
	}
}

initializeDatabase().catch(console.error);
