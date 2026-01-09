import { NextRequest, NextResponse } from 'next/server';
import { k8sService } from '@/lib/k8s-service';
import { getAuthUser } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { getOSTimeoutMinutes } from '@/lib/settings';

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
    const { osType } = body;

    if (!osType || osType !== 'debian') {
      return NextResponse.json(
        { success: false, error: 'Invalid OS type. Must be "debian"' },
        { status: 400 }
      );
    }

    if (!k8sService.isEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Kubernetes backend is not enabled' },
        { status: 503 }
      );
    }

    // Create K8s namespace and prepare config
    const userInfo = await getUserById(user.user_id);
    if (!userInfo) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const namespace = await k8sService.createUserNamespace(user.user_id);
    const podName = `os-${osType}-${Date.now()}`;
    const serviceName = `${podName}-service`;

    const config = {
      userId: user.user_id,
      osType: osType as 'debian',
      namespace,
      podName,
      serviceName,
    };

    // Start the OS pod
    const result = await k8sService.deployOSPod(config);

    if (result.success) {
      // Get OS timeout setting
      const timeoutMinutes = await getOSTimeoutMinutes();
      const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

      return NextResponse.json({
        success: true,
        message: `${osType.toUpperCase()} OS started successfully`,
        data: {
          podName,
          url: result.url,
          vncUrl: result.vncUrl,
          osType,
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
    console.error('Error starting OS:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}