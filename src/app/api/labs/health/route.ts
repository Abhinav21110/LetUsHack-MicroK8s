import { NextResponse } from 'next/server';
import { k8sService } from '@/lib/k8s-service';

export async function GET() {
  try {
    const k8sAvailable = k8sService.isEnabled();
    
    return NextResponse.json({
      success: true,
      data: {
        k8sAvailable,
        message: k8sAvailable 
          ? 'Kubernetes service is available and ready'
          : 'Kubernetes service is not available. Please check cluster status.'
      }
    });

  } catch (error) {
    console.error('Error checking Kubernetes health:', error);
    return NextResponse.json({
      success: false,
      data: {
        k8sAvailable: false,
        message: 'Error checking Kubernetes service availability'
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
