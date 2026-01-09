require("dotenv").config({ path: ".env.local" });
const Docker = require("dockerode");
const { Pool } = require("pg");

const docker = new Docker();

const pool = new Pool({
	host: process.env.PGHOST || "localhost",
	port: parseInt(process.env.PGPORT || "5432"),
	user: process.env.PGUSER || "postgres",
	password: process.env.PGPASSWORD,
	database: "letushack_db",
});

async function cleanupContainers() {
	console.log("🧹 Starting container cleanup...");

	try {
		// Get all containers
		const containers = await docker.listContainers({ all: true });

		// Filter lab challenge containers (both old and new naming patterns)
		const labContainers = containers.filter((container) =>
			container.Names.some(
				(name) =>
					name.includes("xss-") ||
					name.includes("os_debian") ||
					name.includes("nmap") ||
					name.includes("csrf-") ||
					name.includes("xss_") ||
					name.includes("csrf_") ||
					name.includes("test-xss") ||
					name.includes("test-csrf")
			)
		);

		console.log(`Found ${labContainers.length} lab containers`);

		// Stop and remove each container
		for (const containerInfo of labContainers) {
			try {
				const container = docker.getContainer(containerInfo.Id);

				if (containerInfo.State === "running") {
					console.log(`Stopping container: ${containerInfo.Names[0]}`);
					await container.stop();
				}

				console.log(`Removing container: ${containerInfo.Names[0]}`);
				await container.remove();
			} catch (error) {
				console.error(
					`Error cleaning up container ${containerInfo.Id}:`,
					error.message
				);
			}
		}

		// Clean up database records
		try {
			const result = await pool.query("DELETE FROM active_containers");
			console.log(`Cleaned up ${result.rowCount} database records`);
		} catch (error) {
			console.error("Error cleaning up database:", error.message);
		}

		// Clean up unused images (optional)
		console.log("\n🗑️  Cleaning up unused images...");
		try {
			const images = await docker.listImages();
			const labImages = images.filter(
				(image) =>
					image.RepoTags &&
					image.RepoTags.some(
						(tag) =>
							tag.includes("xss-challenge") || tag.includes("csrf-challenge")
					)
			);

			for (const imageInfo of labImages) {
				try {
					const image = docker.getImage(imageInfo.Id);
					await image.remove();
					console.log(`Removed image: ${imageInfo.RepoTags[0]}`);
				} catch (error) {
					console.log(
						`Image ${imageInfo.RepoTags[0]} is in use or has dependencies`
					);
				}
			}
		} catch (error) {
			console.error("Error cleaning up images:", error.message);
		}

		console.log("\n✅ Container cleanup completed!");
	} catch (error) {
		console.error("❌ Cleanup failed:", error);
	} finally {
		await pool.end();
	}
}

// Run cleanup if called directly
if (require.main === module) {
	cleanupContainers();
}

module.exports = { cleanupContainers };
