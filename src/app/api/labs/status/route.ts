import { NextRequest, NextResponse } from "next/server";
import { k8sService } from "@/lib/k8s-service";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
	try {
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

		const activeLabs = await k8sService.getUserActiveK8sLabs(user.user_id);

		return NextResponse.json({
			success: true,
			data: {
				activeContainers: activeLabs.map(lab => ({
					containerId: lab.podName,  // Use podName as containerId for backwards compatibility
					podName: lab.podName,
					namespace: lab.namespace,
					labType: lab.labType,
					url: lab.url,
					status: lab.status,
					port: 80,  // K8s labs use port 80 internally
					createdAt: lab.createdAt.toISOString()
				}))
			}
		});
	} catch (error) {
		console.error("Error fetching lab status:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 }
		);
	}
}
