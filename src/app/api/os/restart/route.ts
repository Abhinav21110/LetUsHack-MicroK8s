import { NextRequest, NextResponse } from 'next/server';
import { k8sService } from '@/lib/k8s-service';
import { getAuthUser } from '@/lib/auth';
import { getUserById } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get user from httpOnly cookie
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!k8sService.isEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Kubernetes backend is not enabled' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { podName, osType } = body;

    if (!podName || !osType) {
      return NextResponse.json(
        { success: false, error: 'Pod name and OS type are required' },
        { status: 400 }
      );
    }

    // Get active containers to find namespace
    const activeContainers = await k8sService.getUserActiveK8sOSContainers(user.user_id);
    const container = activeContainers.find(c => c.podName === podName);
    
    if (!container) {
      return NextResponse.json(
        { success: false, error: 'OS container not found' },
        { status: 404 }
      );
    }

    // Delete the old pod
    await k8sService.deleteOSPod(container.namespace, podName);

    // Create new pod
    const userInfo = await getUserById(user.user_id);
    if (!userInfo) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const newPodName = `os-${osType}-${Date.now()}`;
    const config = {
      userId: user.user_id,
      osType: osType as 'debian',
      namespace: container.namespace,
      podName: newPodName,
      serviceName: `${newPodName}-service`,
    };

    const result = await k8sService.deployOSPod(config);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'OS pod restarted successfully',
        data: {
          podName: newPodName,
          url: result.url,
          vncUrl: result.vncUrl,
          osType
        }
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error restarting OS container:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}