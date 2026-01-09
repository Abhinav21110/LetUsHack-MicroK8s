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
    const { podName, namespace } = body;

    if (!podName || !namespace) {
      return NextResponse.json(
        { success: false, error: 'Pod name and namespace are required' },
        { status: 400 }
      );
    }

    const result = await k8sService.deleteLabPod(namespace, podName);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Lab stopped successfully'
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error stopping lab:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
