import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
	// Use relative paths for built assets so they work behind path-based proxies
	base: "./",
	server: {
		host: "::",
		port: 80,
	},
	plugins: [react(), mode === "development" && componentTagger()].filter(
		Boolean
	),
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
}));
