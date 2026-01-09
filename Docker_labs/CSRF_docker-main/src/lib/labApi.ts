// API functions for lab score management
// Use the main web URL from runtime config injected by Docker container
declare global {
	interface Window {
		__APP_CONFIG__?: {
			MAIN_WEB_URL: string;
		};
	}
}

const BASE_URL =
	window.__APP_CONFIG__?.MAIN_WEB_URL ||
	import.meta.env.VITE_MAIN_WEB_URL ||
	"https://letushack.com";

interface LabScoreUpdate {
	user_id: string;
	lab_id: number;
	level: number;
	score: number;
	solved: boolean;
}
console.log("Lab API base:", BASE_URL);
interface LabStatus {
	user_id: string;
	lab_id: number;
	level: number;
	solved: boolean;
}

export const labApi = {
	// Update lab score in the database
	async updateLabScore(labData: LabScoreUpdate): Promise<boolean> {
		try {
			const response = await fetch(`${BASE_URL}/api/lab-scores/update`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include", // Include cookies for authentication
				body: JSON.stringify(labData),
			});

			if (response.ok) {
				const result = await response.json();
				return result.success;
			}
			return false;
		} catch (error) {
			console.error("Error updating lab score:", error);
			return false;
		}
	},

	// Get lab status for a user
	async getLabStatus(userId: string, labId: number): Promise<LabStatus[]> {
		try {
			const response = await fetch(
				`${BASE_URL}/api/lab-scores/status?user_id=${userId}&lab_id=${labId}`,
				{
					credentials: "include",
				}
			);

			if (response.ok) {
				const result = await response.json();
				return result.data || [];
			}
			return [];
		} catch (error) {
			console.error("Error fetching lab status:", error);
			return [];
		}
	},

	// Get current user info
	async getCurrentUser(): Promise<{ user_id: string } | null> {
		try {
			const response = await fetch(`${BASE_URL}/api/auth/check`, {
				credentials: "include",
			});

			if (response.ok) {
				const result = await response.json();
				return result.authenticated ? result.user : null;
			}
			return null;
		} catch (error) {
			console.error("Error fetching current user:", error);
			return null;
		}
	},
};
