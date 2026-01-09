import { NextRequest, NextResponse } from 'next/server';
import { k8sService } from '@/lib/k8s-service';
import { getAuthUser } from '@/lib/auth';

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
    const { podName } = body;

    // Get user's active OS containers
    const activeContainers = await k8sService.getUserActiveK8sOSContainers(user.user_id);
    
    if (activeContainers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active OS containers found' },
        { status: 404 }
      );
    }

    // Stop specific pod or all user's OS pods
    if (podName) {
      const container = activeContainers.find(c => c.podName === podName);
      if (!container) {
        return NextResponse.json(
          { success: false, error: 'OS container not found' },
          { status: 404 }
        );
      }
      const result = await k8sService.deleteOSPod(container.namespace, podName);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        );
      }
    } else {
      // Stop all user's OS containers
      for (const container of activeContainers) {
        await k8sService.deleteOSPod(container.namespace, container.podName);
      }
    }

    const result = { success: true };

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: podName 
          ? 'OS pod stopped successfully' 
          : 'All user OS pods stopped successfully'
      });
    } else {
      return NextResponse.json(
        { success: false, error: (result as any).error || 'Failed to stop OS pod' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error stopping OS container:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}