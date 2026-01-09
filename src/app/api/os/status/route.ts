import { NextRequest, NextResponse } from "next/server";
import { k8sService } from "@/lib/k8s-service";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
	try {
		// Get user from httpOnly cookie
		const user = await getAuthUser(request);
		if (!user) {
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 }
			);
		}

		if (!k8sService.isEnabled()) {
			return NextResponse.json(
				{ success: false, error: "Kubernetes backend is not enabled" },
				{ status: 503 }
			);
		}

		// Get user's active OS pods
		const activeOSContainers = await k8sService.getUserActiveK8sOSContainers(
			user.user_id
		);

		return NextResponse.json({
			success: true,
			data: {
				activeOSContainers: activeOSContainers.map((container) => {
					// Handle cases where URL might already be a full vnc.html URL or just a base path
					const baseUrl = container.url ? (container.url.endsWith('/') ? container.url : container.url.substring(0, container.url.lastIndexOf('/') + 1)) : '';
					
					return {
						podName: container.podName,
						osType: container.osType,
						vncUrl: `${baseUrl}vnc.html?autoconnect=true&password=debian`,
						url: `${baseUrl}vnc.html?autoconnect=true&resize=scale&password=debian&path=websockify`,
						status: container.status,
						createdAt: container.createdAt,
					};
				}),
			},
		});
	} catch (error) {
		console.error("Error getting OS container status:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 }
		);
	}
}