import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";

// Flag generation plugin
function flagGeneratorPlugin() {
	return {
		name: "flag-generator",
		configureServer() {
			// Run flag generation when dev server starts
			try {
				console.log("🚩 Generating randomized flags...");
				execSync("node scripts/generateFlags.js", {
					stdio: "pipe", // Hide output to keep flags secret
					cwd: process.cwd(),
				});
				console.log("✅ CTF flags ready!\n");
			} catch (error) {
				console.error("❌ Failed to generate flags:", error);
			}
		},
		buildStart() {
			// Also run during build
			try {
				console.log("🚩 Generating randomized flags for build...");
				execSync("node scripts/generateFlags.js", {
					stdio: "pipe", // Hide output to keep flags secret
					cwd: process.cwd(),
				});
				console.log("✅ CTF flags ready for build!\n");
			} catch (error) {
				console.error("❌ Failed to generate flags:", error);
			}
		},
	};
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
	base: "./", // Use relative paths for assets
	server: {
		host: "::",
		port: 80,
	},
	plugins: [flagGeneratorPlugin(), react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
}));
