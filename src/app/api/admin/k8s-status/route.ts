import { NextRequest, NextResponse } from 'next/server';
import { k8sService } from '@/lib/k8s-service';
import { getAuthUser } from '@/lib/auth';
import * as k8s from '@kubernetes/client-node';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    // Allow unauthenticated access for admin dashboard (you can add auth later)
    const isAdmin = request.headers.get('x-admin-key') === process.env.ADMIN_SECRET_KEY;

    if (!k8sService.isEnabled()) {
      return NextResponse.json({
        success: false,
        error: 'Kubernetes is not enabled'
      }, { status: 503 });
    }

    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const coreApi = kc.makeApiClient(k8s.CoreV1Api);
    const appsApi = kc.makeApiClient(k8s.AppsV1Api);
    const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

    // Get all namespaces with our prefix
    const namespacePrefix = process.env.K8S_NAMESPACE_PREFIX || 'letushack';
    const allNamespaces = await coreApi.listNamespace();
    const letushackNamespaces = allNamespaces.items
      .filter((ns: k8s.V1Namespace) => ns.metadata?.name?.startsWith(namespacePrefix))
      .map((ns: k8s.V1Namespace) => ({
        name: ns.metadata?.name,
        status: ns.status?.phase,
        createdAt: ns.metadata?.creationTimestamp,
        labels: ns.metadata?.labels
      }));

    // Get all pods across letushack namespaces
    const allPods: any[] = [];
    for (const ns of letushackNamespaces) {
      try {
        const pods = await coreApi.listNamespacedPod({ namespace: ns.name! });
        pods.items.forEach((pod: k8s.V1Pod) => {
          allPods.push({
            name: pod.metadata?.name,
            namespace: pod.metadata?.namespace,
            status: pod.status?.phase,
            ready: pod.status?.conditions?.find((c: k8s.V1PodCondition) => c.type === 'Ready')?.status,
            restarts: pod.status?.containerStatuses?.[0]?.restartCount || 0,
            age: pod.metadata?.creationTimestamp,
            ip: pod.status?.podIP,
            node: pod.spec?.nodeName,
            labels: pod.metadata?.labels,
            containers: pod.spec?.containers?.map((c: k8s.V1Container) => ({
              name: c.name,
              image: c.image,
              resources: c.resources
            }))
          });
        });
      } catch (err) {
        console.error(`Error getting pods from namespace ${ns.name}:`, err);
      }
    }

    // Get all deployments
    const allDeployments: any[] = [];
    for (const ns of letushackNamespaces) {
      try {
        const deployments = await appsApi.listNamespacedDeployment({ namespace: ns.name! });
        deployments.items.forEach((dep: k8s.V1Deployment) => {
          allDeployments.push({
            name: dep.metadata?.name,
            namespace: dep.metadata?.namespace,
            replicas: dep.status?.replicas,
            ready: dep.status?.readyReplicas,
            available: dep.status?.availableReplicas,
            labels: dep.metadata?.labels
          });
        });
      } catch (err) {
        console.error(`Error getting deployments from namespace ${ns.name}:`, err);
      }
    }

    // Get all services
    const allServices: any[] = [];
    for (const ns of letushackNamespaces) {
      try {
        const services = await coreApi.listNamespacedService({ namespace: ns.name! });
        services.items.forEach((svc: k8s.V1Service) => {
          allServices.push({
            name: svc.metadata?.name,
            namespace: svc.metadata?.namespace,
            type: svc.spec?.type,
            clusterIP: svc.spec?.clusterIP,
            ports: svc.spec?.ports?.map((p: k8s.V1ServicePort) => `${p.port}:${p.targetPort}/${p.protocol}`),
            labels: svc.metadata?.labels
          });
        });
      } catch (err) {
        console.error(`Error getting services from namespace ${ns.name}:`, err);
      }
    }

    // Get all ingresses
    const allIngresses: any[] = [];
    for (const ns of letushackNamespaces) {
      try {
        const ingresses = await networkingApi.listNamespacedIngress({ namespace: ns.name! });
        ingresses.items.forEach((ing: k8s.V1Ingress) => {
          allIngresses.push({
            name: ing.metadata?.name,
            namespace: ing.metadata?.namespace,
            hosts: ing.spec?.rules?.map((r: k8s.V1IngressRule) => r.host),
            paths: ing.spec?.rules?.flatMap((r: k8s.V1IngressRule) => r.http?.paths?.map((p: k8s.V1HTTPIngressPath) => p.path)),
            labels: ing.metadata?.labels
          });
        });
      } catch (err) {
        console.error(`Error getting ingresses from namespace ${ns.name}:`, err);
      }
    }

    // Get cluster info
    const nodes = await coreApi.listNode();
    const clusterInfo = {
      nodeCount: nodes.items.length,
      nodes: nodes.items.map((node: k8s.V1Node) => ({
        name: node.metadata?.name,
        status: node.status?.conditions?.find((c: k8s.V1NodeCondition) => c.type === 'Ready')?.status,
        version: node.status?.nodeInfo?.kubeletVersion,
        os: node.status?.nodeInfo?.osImage,
        capacity: {
          cpu: node.status?.capacity?.cpu,
          memory: node.status?.capacity?.memory,
          pods: node.status?.capacity?.pods
        },
        allocatable: {
          cpu: node.status?.allocatable?.cpu,
          memory: node.status?.allocatable?.memory,
          pods: node.status?.allocatable?.pods
        }
      }))
    };

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalNamespaces: letushackNamespaces.length,
          totalPods: allPods.length,
          runningPods: allPods.filter(p => p.status === 'Running').length,
          totalDeployments: allDeployments.length,
          totalServices: allServices.length,
          totalIngresses: allIngresses.length
        },
        namespaces: letushackNamespaces,
        pods: allPods,
        deployments: allDeployments,
        services: allServices,
        ingresses: allIngresses,
        cluster: clusterInfo,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting K8s status:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get K8s status'
    }, { status: 500 });
  }
}
