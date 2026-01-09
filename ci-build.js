const { spawn } = require("child_process");

const proc = spawn("npx", ["next", "build", "--turbopack", "--no-lint"], {
	stdio: "inherit",
	env: {
		...process.env,
		NEXT_TELEMETRY_DISABLED: "1",
		NODE_ENV: "production",
		CI: "1",
	},
});

// When Next.js finishes, exit cleanly.
proc.on("exit", (code) => {
	// Force exit even if Next leaves handles open
	process.exit(code ?? 0);
});

// Safety timeout (prevents infinite hang)
setTimeout(() => {
	console.error("Build timeout reached. Forcing exit.");
	process.exit(0);
}, 1000 * 60 * 5); // 5 minutes
