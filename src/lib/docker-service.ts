import Docker from "dockerode";
import { Pool } from "pg";
import { getUserById } from "./db";

const docker = new Docker();

const pool = new Pool({
	host: process.env.PGHOST || "localhost",
	port: parseInt(process.env.PGPORT || "5432"),
	user: process.env.PGUSER || "postgres",
	password: process.env.PGPASSWORD,
	database: "letushack_db",
});

export interface ContainerInfo {
	containerId: string;
	userId: string;
	labType: "xss" | "csrf" | "nmap" | "linux";
	port: number;
	status: "running" | "stopped" | "error";
	createdAt: Date;
}

export interface OSContainerInfo {
	containerId: string;
	userId: string;
	osType: "debian";
	status: "running" | "stopped" | "error";
	createdAt: Date;
}

export class DockerService {
	private static instance: DockerService;
	private activeContainers: Map<string, ContainerInfo> = new Map();
	private activeOSContainers: Map<string, OSContainerInfo> = new Map();
	private dockerAvailable = false;
	private traefikNetworkName: string | null = null;

	private constructor() {
		this.checkDockerAvailability();
	}

	public static getInstance(): DockerService {
		if (!DockerService.instance) {
			DockerService.instance = new DockerService();
		}
		return DockerService.instance;
	}

	// ========================================
	// OS Container Port Management
	// ========================================

	/**
	 * Get memory limit for OS containers
	 */
	private getMemoryLimit(): number {
		const limit = process.env.OS_CONTAINER_MEMORY_LIMIT || "2g";
		// Convert to bytes (Docker expects bytes)
		if (limit.endsWith("g") || limit.endsWith("G")) {
			return parseFloat(limit) * 1024 * 1024 * 1024;
		} else if (limit.endsWith("m") || limit.endsWith("M")) {
			return parseFloat(limit) * 1024 * 1024;
		}
		return 2 * 1024 * 1024 * 1024; // Default 2GB
	}

	/**
	 * Get CPU limit for OS containers
	 */
	private getCpuLimit(): number {
		const limit = process.env.OS_CONTAINER_CPU_LIMIT || "2";
		// Docker CpuQuota is in microseconds, 100000 = 1 CPU
		return parseFloat(limit) * 100000;
	}

	/**
	 * Resolve the Traefik Docker network name.
	 * Strategy:
	 * 1) Respect TRAEFIK_NETWORK if set and exists
	 * 2) Prefer the network attached to a running Traefik container
	 * 3) Try common defaults and suffix auto-detect
	 */
	private async resolveTraefikNetwork(): Promise<string> {
		try {
			const preferred = process.env.TRAEFIK_NETWORK?.trim();
			const networks = await docker.listNetworks();

			const byName = (name: string) =>
				networks.find(
					(n) =>
						n.Name === name || n.Labels?.["com.docker.network.name"] === name
				);

			// 1) If env is set and exists, use it
			if (preferred) {
				const match = byName(preferred);
				if (match) {
					this.traefikNetworkName = match.Name;
					return match.Name;
				}
				console.warn(
					`Configured TRAEFIK_NETWORK='${preferred}' not found. Attempting auto-detect...`
				);
			}

			// 2) Prefer the network the Traefik container is attached to
			try {
				const containers = await docker.listContainers();
				const traefikCandidates = containers.filter(
					(c) =>
						c.Image?.toLowerCase().startsWith("traefik") ||
						c.Names?.some((n) => n.toLowerCase().includes("traefik"))
				);
				if (traefikCandidates.length > 0) {
					const traefik = docker.getContainer(traefikCandidates[0].Id);
					const inspect = await traefik.inspect();
					const nets = Object.keys(inspect.NetworkSettings?.Networks || {});
					const preferredNet =
						nets.find((n) => n.endsWith("_traefik-net")) || nets[0];
					if (preferredNet && byName(preferredNet)) {
						this.traefikNetworkName = preferredNet;
						return preferredNet;
					}
				}
			} catch {
				// ignore
			}

			// 3) Common defaults
			const candidates = ["basic-website_traefik-net", "traefik_traefik-net"];
			for (const cand of candidates) {
				const match = byName(cand);
				if (match) {
					this.traefikNetworkName = match.Name;
					return match.Name;
				}
			}

			// 4) Any network ending in _traefik-net
			const suffixMatches = networks.filter((n) =>
				n.Name.endsWith("_traefik-net")
			);
			if (suffixMatches.length >= 1) {
				this.traefikNetworkName = suffixMatches[0].Name;
				return suffixMatches[0].Name;
			}

			throw new Error(
				"Traefik network not found. Start Traefik or set TRAEFIK_NETWORK."
			);
		} catch (e) {
			const msg =
				e instanceof Error ? e.message : "Failed to resolve Traefik network";
			throw new Error(
				`${msg} — Expected a Docker network named '<project>_traefik-net'. ` +
					`Try: docker compose -f traefik/docker-compose.yml -p basic-website up -d ` +
					`or set TRAEFIK_NETWORK to your network name (e.g. 'traefik_traefik-net').`
			);
		}
	}

	private async checkDockerAvailability(): Promise<void> {
		try {
			await docker.ping();
			this.dockerAvailable = true;
			console.log("Docker connection established");
		} catch (error) {
			this.dockerAvailable = false;
			console.warn(
				"Docker is not available:",
				error instanceof Error ? error.message : "Unknown error"
			);
		}
	}

	public async isDockerAvailable(): Promise<boolean> {
		if (!this.dockerAvailable) {
			await this.checkDockerAvailability();
		}
		return this.dockerAvailable;
	}

	private sanitizeContainerName(userId: string, labType: string): string {
		const sanitizedUserId = userId
			.replace(/[^a-zA-Z0-9_.-]/g, "_")
			.replace(/^[^a-zA-Z0-9]/, "u")
			.substring(0, 20);

		const timestamp = Date.now();
		return `${labType}_${sanitizedUserId}_${timestamp}`;
	}

	private sanitizeOSContainerName(userId: string, osType: string): string {
		const sanitizedUserId = userId
			.replace(/[^a-zA-Z0-9_.-]/g, "_")
			.replace(/^[^a-zA-Z0-9]/, "u")
			.substring(0, 20);

		const timestamp = Date.now();
		return `os_${osType}_${sanitizedUserId}_${timestamp}`;
	}

	private slugify(input: string): string {
		return input
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	}

	private getImageName(labType: "xss" | "csrf" | "nmap" | "linux"): string {
		return labType === "xss"
			? "xss_lab"
			: labType === "csrf"
			? "csrf_lab"
			: labType === "nmap"
			? "nmap_lab"
			: "linux";
	}

	private getOSImageName(osType: "debian"): string {
		return osType === "debian"
			? "os-container-single-port"
			: "os-container-single-port";
	}

	private async verifyImageExists(imageName: string): Promise<boolean> {
		try {
			await docker.getImage(imageName).inspect();
			return true;
		} catch {
			return false;
		}
	}

	private async stopUserContainers(userId: string): Promise<void> {
		const userContainers = Array.from(this.activeContainers.entries()).filter(
			([, info]) => info.userId === userId
		);

		for (const [containerId] of userContainers) {
			await this.stopSingleContainer(containerId, userId);
		}
	}

	private async stopUserOSContainers(userId: string): Promise<void> {
		const userOSContainers = Array.from(
			this.activeOSContainers.entries()
		).filter(([, info]) => info.userId === userId);

		for (const [containerId] of userOSContainers) {
			await this.stopSingleOSContainer(containerId, userId);
		}
	}

	private async getDockerHostIP(): Promise<string> {
		try {
			// First try to get the Traefik network gateway (this is where Traefik runs)
			const traefikNetworkName = await this.resolveTraefikNetwork();
			const networks = await docker.listNetworks();
			const traefikNetwork = networks.find(
				(n) => n.Name === traefikNetworkName
			);

			if (traefikNetwork && traefikNetwork.IPAM?.Config?.[0]?.Gateway) {
				console.log(
					`Using Traefik network gateway: ${traefikNetwork.IPAM.Config[0].Gateway}`
				);
				return traefikNetwork.IPAM.Config[0].Gateway;
			}

			// Fallback: Try bridge network
			const bridgeNetwork = networks.find((n) => n.Name === "bridge");
			if (bridgeNetwork && bridgeNetwork.IPAM?.Config?.[0]?.Gateway) {
				console.log(
					`Using bridge network gateway: ${bridgeNetwork.IPAM.Config[0].Gateway}`
				);
				return bridgeNetwork.IPAM.Config[0].Gateway;
			}

			// Final fallback
			console.log("Using default bridge gateway: 172.17.0.1");
			return "172.17.0.1";
		} catch (error) {
			console.error("Error getting Docker host IP:", error);
			return "172.17.0.1";
		}
	}

	private async stopSingleContainer(
		containerId: string,
		userId?: string
	): Promise<void> {
		console.log(
			`Stopping container ${containerId}${userId ? ` for user ${userId}` : ""}`
		);

		this.activeContainers.delete(containerId);

		try {
			const container = docker.getContainer(containerId);

			try {
				const inspect = await container.inspect();
				if (inspect.State.Running) {
					console.log(`Container ${containerId} is running, stopping it...`);
					await container.stop();
				} else {
					console.log(`Container ${containerId} is not running, skipping stop`);
				}
			} catch {
				console.log(
					`Container ${containerId} not found during inspect, skipping stop`
				);
			}

			try {
				await container.remove();
				console.log(`Container ${containerId} removed successfully`);
			} catch (removeError: any) {
				if (removeError.statusCode === 404) {
					console.log(`Container ${containerId} already removed`);
				} else if (removeError.statusCode === 409) {
					console.log(`Container ${containerId} removal already in progress`);
					await new Promise((resolve) => setTimeout(resolve, 1000));
					try {
						await container.remove();
						console.log(`Container ${containerId} removed on retry`);
					} catch {
						console.log(
							`Container ${containerId} removal retry failed, continuing cleanup`
						);
					}
				} else {
					console.error(
						`Error removing container ${containerId}:`,
						removeError
					);
				}
			}
		} catch (error) {
			console.error(`Error during container ${containerId} operations:`, error);
		}

		try {
			await this.removeContainerInfo(containerId);
			console.log(`Database record for container ${containerId} removed`);
		} catch (dbError) {
			console.error(
				`Error removing container ${containerId} from database:`,
				dbError
			);
		}
	}

	private async stopSingleOSContainer(
		containerId: string,
		userId?: string
	): Promise<void> {
		console.log(
			`Stopping OS container ${containerId}${
				userId ? ` for user ${userId}` : ""
			}`
		);

		this.activeOSContainers.delete(containerId);

		try {
			const container = docker.getContainer(containerId);

			try {
				const inspect = await container.inspect();
				if (inspect.State.Running) {
					console.log(`OS Container ${containerId} is running, stopping it...`);
					await container.stop();
				} else {
					console.log(
						`OS Container ${containerId} is not running, skipping stop`
					);
				}
			} catch {
				console.log(
					`OS Container ${containerId} not found during inspect, skipping stop`
				);
			}

			try {
				await container.remove();
				console.log(`OS Container ${containerId} removed successfully`);
			} catch (removeError: any) {
				if (removeError.statusCode === 404) {
					console.log(`OS Container ${containerId} already removed`);
				} else if (removeError.statusCode === 409) {
					console.log(
						`OS Container ${containerId} removal already in progress`
					);
					await new Promise((resolve) => setTimeout(resolve, 1000));
					try {
						await container.remove();
						console.log(`OS Container ${containerId} removed on retry`);
					} catch (retryError) {
						console.log(
							`OS Container ${containerId} removal retry failed, continuing cleanup`
						);
					}
				} else {
					console.error(
						`Error removing OS container ${containerId}:`,
						removeError
					);
				}
			}
		} catch (error) {
			console.error(
				`Error during OS container ${containerId} operations:`,
				error
			);
		}

		try {
			await this.removeOSContainerInfo(containerId);
			console.log(`Database record for OS container ${containerId} removed`);
		} catch (dbError) {
			console.error(
				`Error removing OS container ${containerId} from database:`,
				dbError
			);
		}
	}

	public async startLabContainer(
		userId: string,
		labType: "xss" | "csrf" | "nmap" | "linux"
	): Promise<{
		success: boolean;
		containerId?: string;
		url?: string;
		port?: number;
		error?: string;
	}> {
		try {
			const dockerAvailable = await this.isDockerAvailable();
			if (!dockerAvailable) {
				return {
					success: false,
					error:
						"Docker is not available. Please ensure Docker Desktop is running and try again.",
				};
			}

			await this.stopUserContainers(userId);

			const user = await getUserById(userId);
			if (!user) {
				return { success: false, error: "User not found" };
			}

			const imageName = this.getImageName(labType);
			const imageExists = await this.verifyImageExists(imageName);
			if (!imageExists) {
				return {
					success: false,
					error: `Docker image '${imageName}' not found. Please build the image first using: docker build -t ${imageName} <path-to-dockerfile>`,
				};
			}

			const containerName = this.sanitizeContainerName(userId, labType);
			console.log(
				`Creating container with name: ${containerName} for user: ${userId}`
			);

			const networkName = await this.resolveTraefikNetwork();

			const userSlug = this.slugify(user.name || userId);

			// Extract hostname from LAB_ORIGIN_URL or default to localhost
			const labOriginUrl = process.env.LAB_ORIGIN_URL || "http://localhost";
			const labHostname = new URL(labOriginUrl).hostname;

			const container = await docker.createContainer({
				Image: imageName,
				name: containerName,
				Env: [`VITE_MAIN_WEB_URL=${process.env.HOST_URL}`],
				Labels: {
					"traefik.enable": "true",
					// Rule to match requests based on hostname and path prefix
					[`traefik.http.routers.${containerName}.rule`]: `Host(\`${labHostname}\`) && PathPrefix(\`/${userSlug}/${labType}\`)`,
					[`traefik.http.routers.${containerName}.entrypoints`]: "web",

					// Define middleware to strip the prefix
					[`traefik.http.routers.${containerName}.middlewares`]: `${containerName}-stripprefix@docker`,

					// Middleware to strip the prefix
					[`traefik.http.middlewares.${containerName}-stripprefix.stripprefix.prefixes`]: `/${userSlug}/${labType}`, // Service definition
					[`traefik.http.services.${containerName}.loadbalancer.server.port`]:
						"80",
					"traefik.docker.network": networkName,
				},
				HostConfig: {
					AutoRemove: true,
				},
				NetworkingConfig: {
					EndpointsConfig: {
						[networkName]: {},
					},
				},
			});

			await container.start();

			const containerInfo: ContainerInfo = {
				containerId: container.id,
				userId,
				labType,
				port: 80,
				status: "running",
				createdAt: new Date(),
			};

			this.activeContainers.set(container.id, containerInfo);
			await this.storeContainerInfo(containerInfo);

			return {
				success: true,
				containerId: container.id,
				url: `${labOriginUrl}/${userSlug}/${labType}/#`,
				port: 80,
			};
		} catch (error) {
			console.error(
				`Error starting ${labType} container for user ${userId}:`,
				error
			);
			return {
				success: false,
				error:
					error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	public async stopLabContainer(
		userId: string,
		containerId?: string
	): Promise<{ success: boolean; error?: string }> {
		try {
			console.log(
				`Stopping container(s) for user ${userId}, containerId: ${
					containerId || "all"
				}`
			);

			if (containerId) {
				await this.stopSingleContainer(containerId, userId);
				console.log(
					`Successfully processed stop request for container: ${containerId}`
				);
			} else {
				console.log(`Stopping all containers for user: ${userId}`);
				await this.stopUserContainers(userId);
				await this.removeUserContainers(userId);
				console.log(`Successfully stopped all containers for user: ${userId}`);
			}

			return { success: true };
		} catch (error) {
			console.error("Error stopping container:", error);
			return {
				success: false,
				error:
					error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	public async startOSContainer(
		userId: string,
		osType: "debian"
	): Promise<{
		success: boolean;
		containerId?: string;
		url?: string;
		vncUrl?: string;
		error?: string;
	}> {
		try {
			const dockerAvailable = await this.isDockerAvailable();
			if (!dockerAvailable) {
				return {
					success: false,
					error:
						"Docker is not available. Please ensure Docker Desktop is running and try again.",
				};
			}

			// Stop existing OS containers for this user
			await this.stopUserOSContainers(userId);

			const user = await getUserById(userId);
			if (!user) {
				return { success: false, error: "User not found" };
			}

			const imageName = this.getOSImageName(osType);
			const imageExists = await this.verifyImageExists(imageName);
			if (!imageExists) {
				return {
					success: false,
					error: `Docker image '${imageName}' not found. Please build the image first.`,
				};
			}

			const containerName = this.sanitizeOSContainerName(userId, osType);
			console.log(
				`Creating OS container with name: ${containerName} for user: ${userId}`
			);

			const networkName = await this.resolveTraefikNetwork();
			const userSlug = this.slugify(user.name || userId);

			// Extract hostname from LAB_ORIGIN_URL or default to localhost
			const labOriginUrl = process.env.LAB_ORIGIN_URL || "http://localhost";
			const labHostname = new URL(labOriginUrl).hostname;

			// Get the Docker host IP address from the Traefik network gateway
			const hostIP = await this.getDockerHostIP();
			const container = await docker.createContainer({
				Image: imageName,
				name: containerName,
				Env: [
					// Pass gateway IP for accessing Traefik
					`GATEWAY_IP=${hostIP}`,
					`USER_SLUG=${userSlug}`,
				],
				HostConfig: {
					AutoRemove: true,
					Memory: this.getMemoryLimit(),
					CpuQuota: this.getCpuLimit(),
				},
				Labels: {
					"traefik.enable": "true",
					// noVNC web interface route - single route for the OS container
					[`traefik.http.routers.${containerName}.rule`]: `Host(\`${labHostname}\`) && PathPrefix(\`/${userSlug}/os/${osType}\`)`,
					[`traefik.http.routers.${containerName}.entrypoints`]: "web",
					[`traefik.http.routers.${containerName}.middlewares`]: `${containerName}-stripprefix@docker`,
					[`traefik.http.middlewares.${containerName}-stripprefix.stripprefix.prefixes`]: `/${userSlug}/os/${osType}`,
					[`traefik.http.middlewares.${containerName}-stripprefix.stripprefix.forceSlash`]:
						"false",
					[`traefik.http.services.${containerName}.loadbalancer.server.port`]:
						"80",
					"traefik.docker.network": networkName,
				},
				NetworkingConfig: {
					EndpointsConfig: {
						[networkName]: {},
					},
				},
			});

			await container.start();

			const osContainerInfo: OSContainerInfo = {
				containerId: container.id,
				userId,
				osType,
				status: "running",
				createdAt: new Date(),
			};

			this.activeOSContainers.set(container.id, osContainerInfo);
			await this.storeOSContainerInfo(osContainerInfo);

			return {
				success: true,
				containerId: container.id,
				url: `${labOriginUrl}/${userSlug}/os/${osType}/`,
				vncUrl: `${labOriginUrl}/${userSlug}/os/${osType}/vnc.html?autoconnect=true&password=debian`,
			};
		} catch (error) {
			console.error(
				`Error starting ${osType} OS container for user ${userId}:`,
				error
			);
			return {
				success: false,
				error:
					error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	public async stopOSContainer(
		userId: string,
		containerId?: string
	): Promise<{ success: boolean; error?: string }> {
		try {
			console.log(
				`Stopping OS container(s) for user ${userId}, containerId: ${
					containerId || "all"
				}`
			);

			if (containerId) {
				await this.stopSingleOSContainer(containerId, userId);
				console.log(
					`Successfully processed stop request for OS container: ${containerId}`
				);
			} else {
				console.log(`Stopping all OS containers for user: ${userId}`);
				await this.stopUserOSContainers(userId);
				await this.removeUserOSContainers(userId);
				console.log(
					`Successfully stopped all OS containers for user: ${userId}`
				);
			}

			return { success: true };
		} catch (error) {
			console.error("Error stopping OS container:", error);
			return {
				success: false,
				error:
					error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	public async restartOSContainer(
		userId: string,
		containerId: string
	): Promise<{
		success: boolean;
		containerId?: string;
		url?: string;
		vncUrl?: string;
		error?: string;
	}> {
		try {
			// Get the current container info
			const containerInfo = this.activeOSContainers.get(containerId);
			if (!containerInfo || containerInfo.userId !== userId) {
				return {
					success: false,
					error: "Container not found or access denied",
				};
			}

			// Stop the current container
			await this.stopSingleOSContainer(containerId, userId);

			// Start a new container with the same OS type
			const startResult = await this.startOSContainer(
				userId,
				containerInfo.osType
			);

			if (startResult.success) {
				return {
					success: true,
					containerId: startResult.containerId,
					url: startResult.url,
					vncUrl: startResult.vncUrl,
				};
			} else {
				return {
					success: false,
					error: startResult.error || "Failed to restart container",
				};
			}
		} catch (error) {
			console.error("Error restarting OS container:", error);
			return {
				success: false,
				error:
					error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	public async getUserActiveOSContainers(
		userId: string
	): Promise<OSContainerInfo[]> {
		await this.syncOSContainerStatus();

		const userOSContainers = Array.from(
			this.activeOSContainers.values()
		).filter((info) => info.userId === userId);

		console.log(
			`Getting active OS containers for user ${userId}: found ${userOSContainers.length} containers`
		);
		userOSContainers.forEach((container) => {
			console.log(
				`  - OS Container ${container.containerId} (${container.osType})`
			);
		});

		return userOSContainers;
	}

	public async getUserActiveContainers(
		userId: string
	): Promise<ContainerInfo[]> {
		await this.syncContainerStatus();

		const userContainers = Array.from(this.activeContainers.values()).filter(
			(info) => info.userId === userId
		);

		console.log(
			`Getting active containers for user ${userId}: found ${userContainers.length} containers`
		);
		userContainers.forEach((container) => {
			console.log(
				`  - Container ${container.containerId} (${container.labType})`
			);
		});

		return userContainers;
	}

	private async syncContainerStatus(): Promise<void> {
		console.log("Syncing container status with Docker daemon...");
		const trackedContainers = Array.from(this.activeContainers.keys());

		for (const containerId of trackedContainers) {
			try {
				const container = docker.getContainer(containerId);
				const inspect = await container.inspect();

				if (!inspect.State.Running) {
					console.log(
						`Container ${containerId} is not running, removing from tracking`
					);
					this.activeContainers.delete(containerId);
					await this.removeContainerInfo(containerId);
				}
			} catch {
				console.log(
					`Container ${containerId} not found in Docker, removing from tracking`
				);
				this.activeContainers.delete(containerId);
				await this.removeContainerInfo(containerId);
			}
		}
	}

	public async getAllActiveContainers(): Promise<ContainerInfo[]> {
		return Array.from(this.activeContainers.values());
	}

	private async storeContainerInfo(info: ContainerInfo): Promise<void> {
		try {
			await pool.query(
				`
        INSERT INTO active_containers (container_id, user_id, lab_type, port, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (container_id) DO UPDATE SET
          status = EXCLUDED.status,
          port = EXCLUDED.port
      `,
				[
					info.containerId,
					info.userId,
					info.labType,
					info.port ?? 80,
					info.status,
					info.createdAt,
				]
			);
		} catch (error) {
			console.error("Error storing container info:", error);
		}
	}

	private async removeContainerInfo(containerId: string): Promise<void> {
		try {
			await pool.query(
				"DELETE FROM active_containers WHERE container_id = $1",
				[containerId]
			);
		} catch (error) {
			console.error("Error removing container info:", error);
		}
	}

	private async removeUserContainers(userId: string): Promise<void> {
		try {
			await pool.query("DELETE FROM active_containers WHERE user_id = $1", [
				userId,
			]);
		} catch (error) {
			console.error("Error removing user containers:", error);
		}
	}

	private async storeOSContainerInfo(info: OSContainerInfo): Promise<void> {
		try {
			await pool.query(
				`
        INSERT INTO active_os_containers (container_id, user_id, os_type, status, created_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (container_id) DO UPDATE SET
          status = EXCLUDED.status
      `,
				[
					info.containerId,
					info.userId,
					info.osType,
					info.status,
					info.createdAt,
				]
			);
		} catch (error) {
			console.error("Error storing OS container info:", error);
		}
	}

	private async removeOSContainerInfo(containerId: string): Promise<void> {
		try {
			await pool.query(
				"DELETE FROM active_os_containers WHERE container_id = $1",
				[containerId]
			);
		} catch (error) {
			console.error("Error removing OS container info:", error);
		}
	}

	private async removeUserOSContainers(userId: string): Promise<void> {
		try {
			await pool.query("DELETE FROM active_os_containers WHERE user_id = $1", [
				userId,
			]);
		} catch (error) {
			console.error("Error removing user OS containers:", error);
		}
	}

	private async syncOSContainerStatus(): Promise<void> {
		console.log("Syncing OS container status with Docker daemon...");
		const trackedOSContainers = Array.from(this.activeOSContainers.keys());

		for (const containerId of trackedOSContainers) {
			try {
				const container = docker.getContainer(containerId);
				const inspect = await container.inspect();

				if (!inspect.State.Running) {
					console.log(
						`OS Container ${containerId} is not running, removing from tracking`
					);
					this.activeOSContainers.delete(containerId);
					await this.removeOSContainerInfo(containerId);
				}
			} catch {
				console.log(
					`OS Container ${containerId} not found in Docker, removing from tracking`
				);
				this.activeOSContainers.delete(containerId);
				await this.removeOSContainerInfo(containerId);
			}
		}
	}

	public async initializeFromDatabase(): Promise<void> {
		try {
			await pool.query(`
				CREATE TABLE IF NOT EXISTS active_containers (
					container_id VARCHAR(255) PRIMARY KEY,
					user_id VARCHAR(255) NOT NULL,
					lab_type VARCHAR(10) NOT NULL,
					port INTEGER NOT NULL DEFAULT 80,
					status VARCHAR(20) NOT NULL,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				)
			`);

			// Ensure 'port' column exists with a sane default for older schemas
			await pool.query(
				"ALTER TABLE active_containers ADD COLUMN IF NOT EXISTS port INTEGER NOT NULL DEFAULT 80"
			);

			const result = await pool.query("SELECT * FROM active_containers");

			for (const row of result.rows) {
				const containerInfo: ContainerInfo = {
					containerId: row.container_id,
					userId: row.user_id,
					labType: row.lab_type,
					port: row.port ?? 80,
					status: row.status,
					createdAt: new Date(row.created_at),
				};

				try {
					const container = docker.getContainer(row.container_id);
					const inspect = await container.inspect();

					if (inspect.State.Running) {
						this.activeContainers.set(row.container_id, containerInfo);
					} else {
						await this.removeContainerInfo(row.container_id);
					}
				} catch {
					await this.removeContainerInfo(row.container_id);
				}
			}

			console.log(
				`Initialized Docker service with ${this.activeContainers.size} active containers`
			);

			// OS containers table and load existing OS containers
			await pool.query(`
				CREATE TABLE IF NOT EXISTS active_os_containers (
					container_id VARCHAR(255) PRIMARY KEY,
					user_id VARCHAR(255) NOT NULL,
					os_type VARCHAR(10) NOT NULL,
					vnc_port INTEGER NOT NULL DEFAULT 6080,
					web_port INTEGER NOT NULL DEFAULT 6080,
					status VARCHAR(20) NOT NULL,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				)
			`);

			// Add web_port column if it doesn't exist (migration)
			try {
				await pool.query(`
					ALTER TABLE active_os_containers 
					ADD COLUMN IF NOT EXISTS web_port INTEGER NOT NULL DEFAULT 6080
				`);
			} catch (error) {
				// Column might already exist, ignore error
				console.log("web_port column migration: ", error);
			}

			const osResult = await pool.query("SELECT * FROM active_os_containers");

			for (const row of osResult.rows) {
				const osContainerInfo: OSContainerInfo = {
					containerId: row.container_id,
					userId: row.user_id,
					osType: row.os_type,
					status: row.status,
					createdAt: new Date(row.created_at),
				};

				try {
					const container = docker.getContainer(row.container_id);
					const inspect = await container.inspect();

					if (inspect.State.Running) {
						this.activeOSContainers.set(row.container_id, osContainerInfo);
					} else {
						await this.removeOSContainerInfo(row.container_id);
					}
				} catch {
					await this.removeOSContainerInfo(row.container_id);
				}
			}

			console.log(
				`Initialized Docker service with ${this.activeContainers.size} active containers and ${this.activeOSContainers.size} active OS containers`
			);
		} catch (error) {
			console.error("Error initializing Docker service:", error);
		}
	}
}

export const dockerService = DockerService.getInstance();
