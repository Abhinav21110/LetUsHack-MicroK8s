#!/usr/bin/env node

/**
 * Create Beta Users (numeric usernames, same display names)
 *
 * Creates 80 beta users using numeric user_id values (0001..0080).
 * Display name (name column) remains the team name from TEAM_NAMES.
 * All accounts use the same shared password (default: letushack@1).
 *
 * Usage:
 *   node scripts/create-beta-users-numeric-userids.js
 *   node scripts/create-beta-users-numeric-userids.js "MySharedPass123"
 *   or set BETA_PASSWORD in .env.local
 */

const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const pool = new Pool({
	host: process.env.PGHOST,
	port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
	user: process.env.PGUSER,
	password: process.env.PGPASSWORD,
	database: process.env.PGDATABASE,
});

const TEAM_NAMES = [
	"ZeroDay Collective",
	"Binary Basilisk",
	"Packet Phantoms",
	"Kernel Panic Crew",
	"Neon Nmap Squad",
	"Circuit Spectres",
	"Quantum Rooters",
	"Exploit Orchid",
	"Stack Smashers",
	"Tor Tessellate",
	"Shadow Sandbox",
	"Crypto Corsairs",
	"Packet Punks",
	"Rogue Router Gang",
	"Binary Barbarians",
	"Fuzzing Foxes",
	"Hex Hivemind",
	"Overflow Oracles",
	"Phreak Phalanx",
	"Neon Nexus Labs",
	"Signal Saboteurs",
	"Packet Paladins",
	"Rust Revenants",
	"Glitch Guild",
	"Binary Nyx",
	"Cobalt Ciphers",
	"Beacon Breachers",
	"Payload Pilots",
	"Stack Shamans",
	"NullRoute Ninjas",
	"Spectral Sockets",
	"Echo Exploiters",
	"Lambda Lurkers",
	"Bit Berserkers",
	"Cipher Centaurs",
	"Vector Valkyries",
	"Torment Trojans",
	"Packet Prophets",
	"Rootkit Rangers",
	"Flux Forensics",
	"Neon Net Nomads",
	"Binary Buccaneers",
	"Quantum Quokkas",
	"Echo Echelon",
	"Glitch Gestalt",
	"Sudo Sultans",
	"Packet Pioneers",
	"Fuzz Fjord",
	"Cipher Crew",
	"Root Ravens",
	"Binary Bastion",
	"Neon Nullifiers",
	"Kernel Knights",
	"Stack Specters",
	"Vector Vipers",
	"Packet Prysm",
	"Tor Tacticians",
	"Echo Engineers",
	"Ghost Gatekeepers",
	"Fuzz Furies",
	"Binary Brokers",
	"Neon Nether",
	"Cipher Coven",
	"Root Resonance",
	"Packet Praetors",
	"Quantum Quarry",
	"Stack Sabers",
	"Tor Tracers",
	"Echo Eidolons",
	"Glitch Garrison",
	"Bit Bionic",
	"Null Nebula",
	"Cipher Command",
	"Root Rioters",
	"Packet Paragons",
	"Flux Fathom",
	"Neon Nomads",
	"Logic Legion",
	"Daemon Drifters",
	"Synth Syndicate",
	"Proxy Pirates",
	"Hash Harriers",
	"Byte Bandits",
	"Grid Guardians",
	"Mainframe Marauders",
	"Script Scavengers",
	"Terminal Titans",
	"Voltage Vanguards",
	"Wifi Wraiths",
	"Cyber Centurions",
	"Data Druids",
	"Entropy Enforcers",
	"Ping Panthers",
	"Router Rebels",
	"Silicon Samurai",
	"Trojan Trackers",
	"Virus Vultures",
	"ZeroByte Zealots",
	"Code Cobras",
	"Shell Shockers",
];

const DESIRED_COUNT = 100;

function numericUserId(index) {
	// index is 0-based; produce 1-based padded string: 0001 .. 0080
	return String(index + 1).padStart(4, "0");
}

async function ensureTables() {
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
}

async function createBetaUsers(sharedPassword) {
	const saltRounds = 10;
	const users = [];

	// Prepare names list ensuring exactly DESIRED_COUNT entries
	const names = TEAM_NAMES.slice(0, DESIRED_COUNT);
	while (names.length < DESIRED_COUNT) {
		names.push(`Beta Team ${names.length + 1}`);
	}

	console.log(
		`\nCreating ${names.length} beta users (numeric user_ids) with shared password...`
	);

	// Pre-hash the shared password once for efficiency
	const sharedPasswordHash = await bcrypt.hash(sharedPassword, saltRounds);

	for (let i = 0; i < names.length; i++) {
		const name = names[i];
		const user_id = numericUserId(i);

		try {
			// Insert or update so re-running replaces password if needed
			await pool.query(
				`INSERT INTO users (user_id, password_hash, name, ip_address, last_activity)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name`,
				[
					user_id,
					sharedPasswordHash,
					name,
					process.env.DEFAULT_IP_ADDRESS || "127.0.0.1",
				]
			);

			await pool.query(
				`INSERT INTO points (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
				[user_id]
			);

			users.push({
				user_id,
				password: sharedPassword,
				name,
				status: "created",
			});
			if ((i + 1) % 20 === 0)
				console.log(`✓ Created/updated ${i + 1} users so far...`);
		} catch (err) {
			console.error(`Error creating/updating ${user_id}:`, err.message);
			users.push({
				user_id,
				password: sharedPassword,
				name,
				status: "error",
				error: err.message,
			});
		}
	}

	return users;
}

async function saveCredentials(users, sharedPassword) {
	const outputPath = path.join(__dirname, "..", "load-beta-users.txt");
	let out = `# Beta Test User Credentials (numeric user_ids)
# Generated: ${new Date().toISOString()}
# Password used: ${sharedPassword}

# Format: user_id:password # display name
`;

	users.forEach((u) => {
		out += `${u.user_id}:${sharedPassword} # ${u.name}\n`;
	});

	fs.writeFileSync(outputPath, out, { mode: 0o600 });
	console.log(`\n✓ Credentials saved to: ${outputPath}\n`);
}

async function main() {
	// Order of precedence: CLI arg -> env BETA_PASSWORD -> default
	const cliArg = process.argv[2];
	const envPw = process.env.BETA_PASSWORD;
	const defaultPw = "letushack@1";
	const sharedPassword =
		typeof cliArg === "string" && cliArg.length > 0
			? cliArg
			: envPw || defaultPw;

	console.log("========================================");
	console.log(`  Creating ${DESIRED_COUNT} Beta Users (numeric user_ids)`);
	console.log("========================================");

	try {
		await ensureTables();
		const users = await createBetaUsers(sharedPassword);
		await saveCredentials(users, sharedPassword);
		console.log(`\n✓ Completed creation/update of ${users.length} users.\n`);
	} catch (err) {
		console.error("Fatal Error:", err);
	} finally {
		await pool.end();
	}
}

main();
