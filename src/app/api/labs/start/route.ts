import { NextRequest, NextResponse } from 'next/server';
import { k8sService } from '@/lib/k8s-service';
import { getAuthUser } from '@/lib/auth';
import { getLabTimeoutMinutes } from '@/lib/settings';

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

    const body = await request.json();
    const { labType } = body;

    if (!labType || !['xss', 'csrf', 'nmap'].includes(labType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid lab type. Must be "xss", "csrf", or "nmap"' },
        { status: 400 }
      );
    }

    if (!k8sService.isEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Kubernetes backend is not enabled' },
        { status: 503 }
      );
    }

    console.log('[K8S] Starting ' + labType + ' lab for user ' + user.user_id);

    const namespace = await k8sService.createUserNamespace(user.user_id);
    const timestamp = Date.now();
    const sanitizedUserId = user.user_id.replace(/[^a-z0-9-]/g, '-').substring(0, 8);
    const podName = labType + '-' + sanitizedUserId + '-' + timestamp;
    const serviceName = labType + '-svc-' + timestamp;

    const result = await k8sService.deployLabPod({
      userId: user.user_id,
      labType,
      namespace,
      podName,
      serviceName,
    });

    if (result.success) {
      // Get lab timeout setting
      const timeoutMinutes = await getLabTimeoutMinutes();
      const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

      return NextResponse.json({
        success: true,
        message: labType.toUpperCase() + ' lab started successfully',
        data: {
          containerId: result.podName,  // Use podName as containerId for consistency
          podName: result.podName,
          namespace: namespace,
          url: result.url,  // Use the URL from K8s service (includes ingress URL)
          labType,
          port: 80,
          status: 'running',
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
          timeoutMinutes
        }
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error starting lab:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
