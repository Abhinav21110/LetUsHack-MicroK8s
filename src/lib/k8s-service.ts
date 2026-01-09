import * as k8s from '@kubernetes/client-node';
import { Pool } from 'pg';
import { getUserById } from './db';

const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    database: 'letushack_db',
});

export interface K8sLabConfig {
    userId: string;
    labType: 'xss' | 'csrf' | 'nmap';
    namespace: string;
    podName: string;
    serviceName: string;
}

export interface K8sOSConfig {
    userId: string;
    osType: 'debian';
    namespace: string;
    podName: string;
    serviceName: string;
}

export interface K8sLabInfo {
    podName: string;
    namespace: string;
    userId: string;
    labType: string;
    status: 'running' | 'pending' | 'stopped' | 'error';
    url?: string;
    createdAt: Date;
}

export class KubernetesService {
    private static instance: KubernetesService;
    private kc!: k8s.KubeConfig;
    private k8sApi!: k8s.CoreV1Api;
    private appsApi!: k8s.AppsV1Api;
    private networkingApi!: k8s.NetworkingV1Api;
    private k8sEnabled: boolean;

    private constructor() {
        this.k8sEnabled = process.env.LAB_BACKEND === 'kubernetes';

        console.log('[K8S-SERVICE] LAB_BACKEND:', process.env.LAB_BACKEND);
        console.log('[K8S-SERVICE] k8sEnabled:', this.k8sEnabled);

        if (this.k8sEnabled) {
            this.kc = new k8s.KubeConfig();
            try {
                // Load from default kubeconfig (~/.kube/config)
                this.kc.loadFromDefault();
                console.log('[K8S-SERVICE] ✓ Kubeconfig loaded successfully');
                console.log('[K8S-SERVICE] Current context:', this.kc.getCurrentContext());
            } catch (error) {
                console.error('[K8S-SERVICE] ✗ Failed to load kubeconfig:', error);
                this.k8sEnabled = false;
            }

            if (this.k8sEnabled) {
                this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
                this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
                this.networkingApi = this.kc.makeApiClient(k8s.NetworkingV1Api);
                console.log('[K8S-SERVICE] ✓ API clients initialized');
            }
        } else {
            console.log('[K8S-SERVICE] Kubernetes backend disabled - using Docker backend');
        }
    }

    public static getInstance(): KubernetesService {
        if (!KubernetesService.instance) {
            KubernetesService.instance = new KubernetesService();
        }
        return KubernetesService.instance;
    }

    public isEnabled(): boolean {
        return this.k8sEnabled;
    }

    /**
     * Create an isolated namespace for a user
     */
    public async createUserNamespace(userId: string): Promise<string> {
        if (!this.k8sEnabled) {
            throw new Error('Kubernetes backend is not enabled');
        }

        const namespacePrefix = process.env.K8S_NAMESPACE_PREFIX || 'letushack';
        const namespace = `${namespacePrefix}-${this.sanitizeUserId(userId)}`;

        const ns: k8s.V1Namespace = {
            metadata: {
                name: namespace,
                labels: {
                    'app.letushack.com/user-id': userId,
                    'app.letushack.com/tenant': 'user',
                    'app.letushack.com/isolation': 'strict',
                },
            },
        };

        try {
            await this.k8sApi.createNamespace({ body: ns });
            console.log(`Created namespace: ${namespace}`);

            // Apply default NetworkPolicy immediately
            await this.applyDefaultNetworkPolicy(namespace, userId);

            return namespace;
        } catch (error: any) {
            if (error.response?.statusCode === 409 || error.code === 409) {
                // Namespace already exists
                console.log(`Namespace already exists: ${namespace}`);
                return namespace;
            }
            throw error;
        }
    }

    /**
     * Apply default deny-all NetworkPolicy to namespace
     */
    private async applyDefaultNetworkPolicy(namespace: string, userId: string): Promise<void> {
        const policy: k8s.V1NetworkPolicy = {
            metadata: {
                name: 'default-deny-all',
                namespace,
                labels: {
                    'app.letushack.com/policy-type': 'baseline',
                },
            },
            spec: {
                podSelector: {},
                policyTypes: ['Ingress', 'Egress'],
            },
        };

        try {
            await this.networkingApi.createNamespacedNetworkPolicy({ namespace, body: policy });
            console.log(`Applied default-deny-all NetworkPolicy to ${namespace}`);
        } catch (error: any) {
            if (error.code === 409 || error.response?.statusCode === 409) {
                console.log(`NetworkPolicy already exists in ${namespace}`);
            } else {
                console.error(`Failed to create NetworkPolicy in ${namespace}:`, error);
            }
        }
    }

    /**
     * Apply allow network policies for lab pods to enable ingress from NGINX and DNS access
     */
    private async applyLabNetworkPolicies(namespace: string, labType: string): Promise<void> {
        // Policy to allow ingress from NGINX Ingress Controller
        const allowIngressPolicy: k8s.V1NetworkPolicy = {
            metadata: {
                name: `allow-ingress-${labType}`,
                namespace,
                labels: {
                    'app.letushack.com/policy-type': 'allow',
                    'app.letushack.com/lab-type': labType,
                },
            },
            spec: {
                podSelector: {
                    matchLabels: {
                        'app': labType,
                        'app.letushack.com/tenant': 'user',
                    },
                },
                policyTypes: ['Ingress'],
                ingress: [
                    {
                        // Allow from NGINX Ingress Controller namespace
                        _from: [{
                            namespaceSelector: {
                                matchLabels: {
                                    'app.kubernetes.io/name': 'ingress-nginx',
                                },
                            },
                        }],
                        ports: [{ port: 80 as any, protocol: 'TCP' }],
                    },
                ],
            },
        };

        // Policy to allow DNS egress for all pods
        const allowDNSPolicy: k8s.V1NetworkPolicy = {
            metadata: {
                name: `allow-dns-${labType}`,
                namespace,
                labels: {
                    'app.letushack.com/policy-type': 'allow',
                    'app.letushack.com/lab-type': labType,
                },
            },
            spec: {
                podSelector: {
                    matchLabels: {
                        'app': labType,
                        'app.letushack.com/tenant': 'user',
                    },
                },
                policyTypes: ['Egress'],
                egress: [
                    {
                        // Allow DNS to kube-system namespace
                        to: [{
                            namespaceSelector: {
                                matchLabels: {
                                    'kubernetes.io/metadata.name': 'kube-system',
                                },
                            },
                        }],
                        ports: [
                            { port: 53 as any, protocol: 'TCP' },
                            { port: 53 as any, protocol: 'UDP' },
                        ],
                    },
                ],
            },
        };

        // Apply policies
        try {
            await this.networkingApi.createNamespacedNetworkPolicy({ namespace, body: allowIngressPolicy });
            console.log(`✓ Created allow-ingress network policy for ${labType} in ${namespace}`);
        } catch (error: any) {
            if (error.code === 409 || error.response?.statusCode === 409) {
                console.log(`✓ Allow-ingress policy already exists for ${labType}`);
            } else {
                console.error(`Failed to create allow-ingress policy:`, error);
            }
        }

        try {
            await this.networkingApi.createNamespacedNetworkPolicy({ namespace, body: allowDNSPolicy });
            console.log(`✓ Created allow-DNS network policy for ${labType} in ${namespace}`);
        } catch (error: any) {
            if (error.code === 409 || error.response?.statusCode === 409) {
                console.log(`✓ Allow-DNS policy already exists for ${labType}`);
            } else {
                console.error(`Failed to create allow-DNS policy:`, error);
            }
        }
    }

    private async applyOSNetworkPolicies(namespace: string, osType: string): Promise<void> {
        // Policy to allow ingress from NGINX Ingress Controller
        const allowIngressPolicy: k8s.V1NetworkPolicy = {
            metadata: {
                name: `allow-ingress-os-${osType}`,
                namespace,
                labels: {
                    'app.letushack.com/policy-type': 'allow',
                    'app.letushack.com/component': 'os-container',
                },
            },
            spec: {
                podSelector: {
                    matchLabels: {
                        'app.letushack.com/component': 'os-container',
                        'app.letushack.com/os-type': osType,
                    },
                },
                policyTypes: ['Ingress'],
                ingress: [
                    {
                        // Allow from NGINX Ingress Controller namespace
                        _from: [{
                            namespaceSelector: {
                                matchLabels: {
                                    'app.kubernetes.io/name': 'ingress-nginx',
                                },
                            },
                        }],
                        ports: [{ port: 80 as any, protocol: 'TCP' }],
                    },
                ],
            },
        };

        // Policy to allow DNS egress
        const allowDNSPolicy: k8s.V1NetworkPolicy = {
            metadata: {
                name: `allow-dns-os-${osType}`,
                namespace,
                labels: {
                    'app.letushack.com/policy-type': 'allow',
                    'app.letushack.com/component': 'os-container',
                },
            },
            spec: {
                podSelector: {
                    matchLabels: {
                        'app.letushack.com/component': 'os-container',
                        'app.letushack.com/os-type': osType,
                    },
                },
                policyTypes: ['Egress'],
                egress: [
                    {
                        // Allow DNS to kube-system namespace
                        to: [{
                            namespaceSelector: {
                                matchLabels: {
                                    'kubernetes.io/metadata.name': 'kube-system',
                                },
                            },
                        }],
                        ports: [
                            { port: 53 as any, protocol: 'TCP' },
                            { port: 53 as any, protocol: 'UDP' },
                        ],
                    },
                    {
                        // Allow all egress for OS containers (they need internet access)
                        // Empty 'to' allows all destinations
                    },
                ],
            },
        };

        // Apply policies
        try {
            await this.networkingApi.createNamespacedNetworkPolicy({ namespace, body: allowIngressPolicy });
            console.log(`✓ Created allow-ingress network policy for OS ${osType} in ${namespace}`);
        } catch (error: any) {
            if (error.code === 409 || error.response?.statusCode === 409) {
                console.log(`✓ Allow-ingress policy already exists for OS ${osType}`);
            } else {
                console.error(`Failed to create allow-ingress policy for OS:`, error);
            }
        }

        try {
            await this.networkingApi.createNamespacedNetworkPolicy({ namespace, body: allowDNSPolicy });
            console.log(`✓ Created allow-DNS/egress network policy for OS ${osType} in ${namespace}`);
        } catch (error: any) {
            if (error.code === 409 || error.response?.statusCode === 409) {
                console.log(`✓ Allow-DNS/egress policy already exists for OS ${osType}`);
            } else {
                console.error(`Failed to create allow-DNS/egress policy for OS:`, error);
            }
        }
    }

    /**
     * Deploy a lab pod (XSS, CSRF, NMAP)
     */
    public async deployLabPod(config: K8sLabConfig): Promise<{
        success: boolean;
        podName?: string;
        url?: string;
        error?: string;
    }> {
        if (!this.k8sEnabled) {
            return { success: false, error: 'Kubernetes backend is not enabled' };
        }

        try {
            // Clean up ONLY existing deployments of the SAME lab type (allow multiple different labs)
            try {
                const existingDeployments = await this.appsApi.listNamespacedDeployment({
                    namespace: config.namespace,
                    labelSelector: `app.letushack.com/lab-type=${config.labType}`
                });

                if (existingDeployments.items.length > 0) {
                    // Filter out the pod we're about to create to prevent race condition
                    const deploymentsToDelete = existingDeployments.items.filter(
                        deployment => deployment.metadata?.name !== config.podName
                    );
                    if (deploymentsToDelete.length > 0) {
                        console.log(`Cleaning up ${deploymentsToDelete.length} existing ${config.labType} deployment(s) for user ${config.userId}`);

                        // Delete existing deployments of the same lab type
                        for (const deployment of deploymentsToDelete) {
                            const podName = deployment.metadata?.name;
                            if (podName) {
                                await this.deleteLabPod(config.namespace, podName);
                            }
                        }
                    }

                    // CRITICAL: Wait for all ingresses to be fully deleted to prevent conflicts
                    console.log(`⏳ Actively waiting for ${config.labType} ingresses to be fully deleted...`);
                    await this.waitForIngressDeletion(config.namespace, config.labType, 30000);
                    console.log('✓ Cleanup complete, proceeding with new lab deployment');
                }
            } catch (cleanupError: any) {
                // If namespace doesn't exist or other error, just log and continue
                if (cleanupError.statusCode !== 404) {
                    console.error('Error during cleanup check:', cleanupError.message);
                }
            }

            const user = await getUserById(config.userId);
            if (!user) {
                return { success: false, error: 'User not found' };
            }

            const userSlug = this.slugify(user.name || config.userId);
            const imageName = this.getLabImageName(config.labType);

            // Generate flags
            const flags = {
                easy: this.generateFlag(),
                medium: this.generateFlag(),
                hard: this.generateFlag(),
            };

            // Create deployment
            const deployment: k8s.V1Deployment = {
                metadata: {
                    name: config.podName,
                    namespace: config.namespace,
                    labels: {
                        'app': config.labType,
                        'app.letushack.com/lab-type': config.labType,
                        'app.letushack.com/user-id': config.userId,
                        'app.letushack.com/tenant': 'user',
                    },
                },
                spec: {
                    replicas: 1,
                    selector: {
                        matchLabels: {
                            'app': config.labType,
                            'user': config.userId,
                        },
                    },
                    template: {
                        metadata: {
                            labels: {
                                'app': config.labType,
                                'user': config.userId,
                                'app.letushack.com/lab-type': config.labType,
                                'app.letushack.com/tenant': 'user',
                            },
                        },
                        spec: {
                            containers: [{
                                name: config.labType,
                                image: imageName,
                                imagePullPolicy: 'Never',  // Use local Docker images
                                ports: [{ containerPort: 80, name: 'http' }],
                                env: [
                                    { name: 'VITE_MAIN_WEB_URL', value: process.env.HOST_URL || 'http://localhost:3000' },
                                    { name: 'FLAG_EASY', value: flags.easy },
                                    { name: 'FLAG_MEDIUM', value: flags.medium },
                                    { name: 'FLAG_HARD', value: flags.hard },
                                ],
                                resources: {
                                    limits: {
                                        memory: '512Mi',
                                        cpu: '500m',
                                    },
                                    requests: {
                                        memory: '256Mi',
                                        cpu: '250m',
                                    },
                                },
                                // Temporarily disabled health checks to troubleshoot
                                // readinessProbe: {
                                //     httpGet: {
                                //         path: '/',
                                //         port: 80 as any,
                                //     },
                                //     initialDelaySeconds: 15,
                                //     periodSeconds: 5,
                                //     timeoutSeconds: 3,
                                //     successThreshold: 1,
                                //     failureThreshold: 6,
                                // },
                                // livenessProbe: {
                                //     httpGet: {
                                //         path: '/',
                                //         port: 80 as any,
                                //     },
                                //     initialDelaySeconds: 30,
                                //     periodSeconds: 10,
                                //     timeoutSeconds: 3,
                                //     successThreshold: 1,
                                //     failureThreshold: 3,
                                // },
                                securityContext: {
                                    runAsNonRoot: false,
                                    allowPrivilegeEscalation: false,
                                },
                            }],
                        },
                    },
                },
            };

            // Create deployment
            await this.appsApi.createNamespacedDeployment({ namespace: config.namespace, body: deployment });

            // Wait for pod to be ready (max 60 seconds)
            console.log(`⏳ Waiting for pod ${config.podName} to become ready...`);
            await this.waitForPodReady(config.namespace, config.podName, 60000);
            console.log(`✓ Pod ${config.podName} is ready`);

            // Create service
            await this.createLabService(config);

            // Apply network policies to allow ingress from NGINX and DNS access
            if (process.env.CALICO_ENABLED === 'true') {
                await this.applyLabNetworkPolicies(config.namespace, config.labType);
            }

            // Create ingress
            const ingressUrl = await this.createLabIngress(config, userSlug);

            // Wait for pod to be ready before returning
            console.log(`⏳ Waiting for lab pod ${config.podName} to be ready...`);
            await this.waitForPodReady(config.namespace, config.podName, 90000);
            console.log(`✓ Lab pod ${config.podName} is ready`);

            // Give ingress controller time to propagate routing rules
            console.log(`⏳ Waiting for ingress routing to propagate...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log(`✓ Ingress routing ready`);

            // Store in database
            await this.storeK8sLabInfo({
                podName: config.podName,
                namespace: config.namespace,
                userId: config.userId,
                labType: config.labType,
                status: 'running',
                url: ingressUrl,
                createdAt: new Date(),
            });

            return {
                success: true,
                podName: config.podName,
                url: ingressUrl,
            };
        } catch (error) {
            console.error('Error deploying lab pod:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Create Kubernetes service for lab pod
     */
    private async createLabService(config: K8sLabConfig): Promise<void> {
        const service: k8s.V1Service = {
            metadata: {
                name: config.serviceName,
                namespace: config.namespace,
                labels: {
                    'app.letushack.com/lab-type': config.labType,
                    'lab-pod': config.podName,
                },
            },
            spec: {
                selector: {
                    'app': config.labType,
                    'user': config.userId,
                },
                ports: [{
                    port: 80,
                    targetPort: 80 as any,
                    protocol: 'TCP',
                }],
                type: 'ClusterIP',
            },
        };

        await this.k8sApi.createNamespacedService({ namespace: config.namespace, body: service });
    }

    /**
     * Create Kubernetes ingress for lab pod
     */
    private async createLabIngress(config: K8sLabConfig, userSlug: string): Promise<string> {
        const ingressName = `${config.labType}-ingress-${Date.now()}`;

        // Validate domain configuration
        const baseDomain = (() => {
            const domain = process.env.K8S_INGRESS_DOMAIN;
            const isProduction = process.env.NODE_ENV === 'production';

            if (!domain || domain.trim() === '') {
                if (isProduction) {
                    throw new Error('K8S_INGRESS_DOMAIN must be set in production');
                }
                console.warn('⚠️ K8S_INGRESS_DOMAIN not set, using localhost (DEV ONLY)');
                return 'localhost';
            }

            if ((domain === 'localhost' || domain.includes('127.0.0.1')) && isProduction) {
                throw new Error('K8S_INGRESS_DOMAIN cannot be localhost in production. Use actual domain.');
            }

            return domain;
        })();

        const port = process.env.K8S_INGRESS_PORT || (process.env.NODE_ENV === 'production' ? '443' : '8100');

        const ingress: k8s.V1Ingress = {
            metadata: {
                name: ingressName,
                namespace: config.namespace,
                labels: {
                    'app.letushack.com/lab-type': config.labType,
                    'lab-pod': config.podName,
                },
                annotations: {
                    'nginx.ingress.kubernetes.io/rewrite-target': '/$2',
                    // Enable SSL redirect in production
                    'nginx.ingress.kubernetes.io/ssl-redirect': process.env.NODE_ENV === 'production' ? 'true' : 'false',
                    // Force HTTPS in production
                    ...(process.env.NODE_ENV === 'production' && {
                        'nginx.ingress.kubernetes.io/force-ssl-redirect': 'true',
                    }),
                },
            },
            spec: {
                ingressClassName: 'nginx',
                // Add TLS configuration for production
                ...(process.env.NODE_ENV === 'production' && {
                    tls: [{
                        hosts: [baseDomain],
                        secretName: 'letushack-tls',
                    }],
                }),
                rules: [{
                    host: baseDomain,
                    http: {
                        paths: [{
                            path: `/${userSlug}/${config.labType}(/|$)(.*)`,
                            pathType: 'ImplementationSpecific',
                            backend: {
                                service: {
                                    name: config.serviceName,
                                    port: { number: 80 },
                                },
                            },
                        }],
                    },
                }],
            },
        };

        await this.networkingApi.createNamespacedIngress({ namespace: config.namespace, body: ingress });

        // Construct URL with proper protocol
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
        const portSuffix = (protocol === 'https' && port === '443') || (protocol === 'http' && port === '80')
            ? ''
            : `:${port}`;

        return `${protocol}://${baseDomain}${portSuffix}/${userSlug}/${config.labType}/`;
    }

    /**
     * Wait for a pod to be ready
     */
    private async waitForPodReady(
        namespace: string,
        deploymentName: string,
        timeoutMs: number = 60000
    ): Promise<void> {
        const startTime = Date.now();
        const pollIntervalMs = 2000; // Check every 2 seconds

        while (Date.now() - startTime < timeoutMs) {
            try {
                // List all pods in namespace and find one matching deployment name
                const pods = await this.k8sApi.listNamespacedPod({ namespace });
                
                // Find pod created by this deployment (has deployment name as prefix)
                const pod = pods.items.find(p => 
                    p.metadata?.name?.startsWith(deploymentName)
                );

                if (!pod) {
                    console.log(`⏳ Waiting for pod with deployment ${deploymentName} to be created...`);
                    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
                    continue;
                }

                const status = pod.status;
                const conditions = status?.conditions || [];
                const readyCondition = conditions.find(c => c.type === 'Ready');
                const containerStatuses = status?.containerStatuses || [];
                
                // Check if all containers are ready
                const allContainersReady = containerStatuses.length > 0 && 
                    containerStatuses.every(cs => cs.ready === true);

                if (readyCondition?.status === 'True' && status?.phase === 'Running' && allContainersReady) {
                    console.log(`✓ Pod ${pod.metadata?.name} is ready and running`);
                    return;
                }

                // Check for error states
                if (status?.phase === 'Failed' || status?.phase === 'Unknown') {
                    throw new Error(`Pod ${pod.metadata?.name} is in ${status.phase} state`);
                }

                console.log(`⏳ Pod ${pod.metadata?.name} - Phase: ${status?.phase}, Ready: ${readyCondition?.status || 'False'}`);

                await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
            } catch (error: any) {
                if (error.statusCode !== 404) {
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
            }
        }

        throw new Error(`Pod ${deploymentName} did not become ready within ${timeoutMs}ms`);
    }

    /**
     * Wait for all ingresses of a specific lab type to be deleted
     * This prevents ingress conflicts when recreating labs
     */
    private async waitForIngressDeletion(
        namespace: string,
        labType: string,
        timeoutMs: number = 30000
    ): Promise<void> {
        const startTime = Date.now();
        const pollIntervalMs = 1000; // Check every second

        while (Date.now() - startTime < timeoutMs) {
            try {
                const ingresses = await this.networkingApi.listNamespacedIngress({ namespace });
                const matchingIngresses = ingresses.items.filter(
                    ing => ing.metadata?.labels?.['app.letushack.com/lab-type'] === labType
                );

                if (matchingIngresses.length === 0) {
                    console.log(`✓ All ${labType} ingresses deleted from ${namespace}`);
                    return;
                }

                console.log(`⏳ Waiting for ${matchingIngresses.length} ${labType} ingress(es) to be deleted...`);
                await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
            } catch (error: any) {
                if (error.statusCode === 404) {
                    // Namespace doesn't exist, so ingresses are definitely gone
                    console.log(`✓ Namespace not found, ingresses are deleted`);
                    return;
                }
                throw error;
            }
        }

        console.warn(`⚠️ Timeout waiting for ${labType} ingresses to be deleted after ${timeoutMs}ms`);
    }

    /**
     * Delete lab pod and cleanup resources
     */
    public async deleteLabPod(namespace: string, podName: string): Promise<{
        success: boolean;
        error?: string;
    }> {
        if (!this.k8sEnabled) {
            return { success: false, error: 'Kubernetes backend is not enabled' };
        }

        try {
            console.log(`Deleting lab resources for pod: ${podName} in namespace: ${namespace}`);

            // Get lab type from database to find all related resources
            const labInfo = await pool.query(
                'SELECT lab_type FROM active_k8s_labs WHERE pod_name = $1',
                [podName]
            );
            const labType = labInfo.rows[0]?.lab_type;

            // Delete deployment
            try {
                await this.appsApi.deleteNamespacedDeployment({ name: podName, namespace });
                console.log(`Deleted deployment: ${podName}`);
            } catch (err: any) {
                if (err.statusCode !== 404) {
                    console.error('Error deleting deployment:', err.message);
                }
            }

            // Delete ALL services with matching lab type (not just exact pod match)
            if (labType) {
                try {
                    const services = await this.k8sApi.listNamespacedService({ namespace });
                    for (const service of services.items) {
                        const svcLabType = service.metadata?.labels?.['app.letushack.com/lab-type'];
                        if (svcLabType === labType) {
                            await this.k8sApi.deleteNamespacedService({
                                name: service.metadata?.name || '',
                                namespace
                            });
                            console.log(`Deleted service: ${service.metadata?.name}`);
                        }
                    }
                } catch (err: any) {
                    if (err.statusCode !== 404) {
                        console.error('Error deleting services:', err.message);
                    }
                }

                // Delete ALL ingresses with matching lab type
                try {
                    const ingresses = await this.networkingApi.listNamespacedIngress({ namespace });
                    for (const ingress of ingresses.items) {
                        const ingressLabType = ingress.metadata?.labels?.['app.letushack.com/lab-type'];
                        if (ingressLabType === labType) {
                            await this.networkingApi.deleteNamespacedIngress({
                                name: ingress.metadata?.name || '',
                                namespace
                            });
                            console.log(`Deleted ingress: ${ingress.metadata?.name}`);
                        }
                    }
                } catch (err: any) {
                    if (err.statusCode !== 404) {
                        console.error('Error deleting ingresses:', err.message);
                    }
                }
            }

            // Cleanup database record
            await this.removeK8sLabInfo(podName);

            return { success: true };
        } catch (error) {
            console.error('Error deleting lab pod:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Get active K8s labs for a user
     */
    public async getUserActiveK8sLabs(userId: string): Promise<K8sLabInfo[]> {
        try {
            const result = await pool.query(
                'SELECT * FROM active_k8s_labs WHERE user_id = $1',
                [userId]
            );

            return result.rows.map(row => ({
                podName: row.pod_name,
                namespace: row.namespace,
                userId: row.user_id,
                labType: row.lab_type,
                status: row.status,
                url: row.url,
                createdAt: new Date(row.created_at),
            }));
        } catch (error) {
            console.error('Error fetching K8s labs:', error);
            return [];
        }
    }

    // Helper methods
    private sanitizeUserId(userId: string): string {
        return userId
            .replace(/[^a-zA-Z0-9-]/g, '-')  // Replace invalid chars with hyphen
            .replace(/^[^a-zA-Z0-9]/, 'u')    // Start with alphanumeric
            .substring(0, 63)                  // K8s max label length
            .toLowerCase()
            .replace(/-+$/, '');               // Remove trailing hyphens
    }

    private slugify(input: string): string {
        return input
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    private getLabImageName(labType: string): string {
        const imageMap: Record<string, string> = {
            xss: 'xss_lab:latest',
            csrf: 'csrf_lab:latest',
            nmap: 'nmap_lab:latest',
        };
        return imageMap[labType] || 'xss_lab:latest';
    }

    private generateFlag(): string {
        return Array.from({ length: 32 }, () =>
            Math.floor(Math.random() * 16).toString(16)
        ).join('');
    }

    private async storeK8sLabInfo(info: K8sLabInfo): Promise<void> {
        await pool.query(
            `INSERT INTO active_k8s_labs (pod_name, namespace, user_id, lab_type, status, url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (pod_name) DO UPDATE 
       SET status = $5, updated_at = NOW()`,
            [info.podName, info.namespace, info.userId, info.labType, info.status, info.url, info.createdAt]
        );
    }

    private async removeK8sLabInfo(podName: string): Promise<void> {
        await pool.query('DELETE FROM active_k8s_labs WHERE pod_name = $1', [podName]);
    }

    /**
     * Deploy OS container pod with VNC desktop support
     */
    public async deployOSPod(config: K8sOSConfig): Promise<{
        success: boolean;
        url?: string;
        vncUrl?: string;
        error?: string;
    }> {
        if (!this.k8sEnabled) {
            return { success: false, error: 'Kubernetes backend is not enabled' };
        }

        try {
            console.log(`Deploying OS pod for user: ${config.userId}, OS: ${config.osType}`);

            // Create namespace if it doesn't exist
            await this.createUserNamespace(config.userId);

            // Apply network policies
            await this.applyDefaultNetworkPolicy(config.namespace, config.userId);
            await this.applyOSNetworkPolicies(config.namespace, config.osType);

            // Delete ALL existing OS deployments for this user (only one OS at a time)
            try {
                const existingDeployments = await this.appsApi.listNamespacedDeployment({
                    namespace: config.namespace,
                    labelSelector: 'app.letushack.com/component=os-container'
                });

                if (existingDeployments.items.length > 0) {
                    console.log(`Cleaning up ${existingDeployments.items.length} existing OS deployment(s)`);
                    for (const deployment of existingDeployments.items) {
                        const podName = deployment.metadata?.name;
                        if (podName) {
                            await this.deleteOSPod(config.namespace, podName);
                        }
                    }
                    // Wait for ingresses to be deleted
                    console.log(`⏳ Waiting for OS ingresses to be fully deleted...`);
                    await this.waitForIngressDeletion(config.namespace, config.osType, 30000);
                    console.log('✓ OS cleanup complete, proceeding with new deployment');
                }
            } catch (cleanupError: any) {
                if (cleanupError.statusCode !== 404) {
                    console.error('Error during OS cleanup:', cleanupError.message);
                }
            }

            // Generate flags and other environment variables
            const user = await getUserById(config.userId);
            if (!user) {
                return { success: false, error: 'User not found' };
            }

            const userSlug = this.slugify(user.name || config.userId);

            // Create deployment for OS container
            const deployment: k8s.V1Deployment = {
                apiVersion: 'apps/v1',
                kind: 'Deployment',
                metadata: {
                    name: config.podName,
                    namespace: config.namespace,
                    labels: {
                        'app.letushack.com/component': 'os-container',
                        'app.letushack.com/os-type': config.osType,
                        'app.letushack.com/user-id': config.userId,
                    },
                },
                spec: {
                    replicas: 1,
                    selector: {
                        matchLabels: {
                            'app.letushack.com/component': 'os-container',
                            'app.letushack.com/os-type': config.osType,
                            'app.letushack.com/user-id': config.userId,
                        },
                    },
                    template: {
                        metadata: {
                            labels: {
                                'app.letushack.com/component': 'os-container',
                                'app.letushack.com/os-type': config.osType,
                                'app.letushack.com/user-id': config.userId,
                            },
                        },
                        spec: {
                            containers: [{
                                name: 'os-desktop',
                                image: this.getOSImageName(config.osType),
                                imagePullPolicy: 'IfNotPresent',
                                env: [
                                    { name: 'USER_SLUG', value: userSlug },
                                    { name: 'VNC_PASSWORD', value: 'debian' },
                                    { name: 'USERNAME', value: 'debian' },
                                ],
                                ports: [{
                                    containerPort: 80,
                                    name: 'http',
                                    protocol: 'TCP',
                                }],
                                resources: {
                                    requests: {
                                        memory: '512Mi',
                                        cpu: '500m',
                                    },
                                    limits: {
                                        memory: '2Gi',
                                        cpu: '2000m',
                                    },
                                },
                                readinessProbe: {
                                    httpGet: {
                                        path: '/',
                                        port: 80 as any,
                                    },
                                    initialDelaySeconds: 10,
                                    periodSeconds: 5,
                                    timeoutSeconds: 3,
                                    successThreshold: 1,
                                    failureThreshold: 5,
                                },
                                livenessProbe: {
                                    httpGet: {
                                        path: '/',
                                        port: 80 as any,
                                    },
                                    initialDelaySeconds: 30,
                                    periodSeconds: 10,
                                    timeoutSeconds: 3,
                                    successThreshold: 1,
                                    failureThreshold: 3,
                                },
                            }],
                        },
                    },
                },
            };

            await this.appsApi.createNamespacedDeployment({ namespace: config.namespace, body: deployment });
            console.log(`Created deployment: ${config.podName}`);

            // Create service
            const service: k8s.V1Service = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: {
                    name: config.serviceName,
                    namespace: config.namespace,
                    labels: {
                        'app.letushack.com/component': 'os-container',
                        'app.letushack.com/os-type': config.osType,
                    },
                },
                spec: {
                    selector: {
                        'app.letushack.com/component': 'os-container',
                        'app.letushack.com/os-type': config.osType,
                        'app.letushack.com/user-id': config.userId,
                    },
                    ports: [{
                        port: 80,
                        targetPort: 80 as any,
                        protocol: 'TCP',
                        name: 'http',
                    }],
                    type: 'ClusterIP',
                },
            };

            await this.k8sApi.createNamespacedService({ namespace: config.namespace, body: service });
            console.log(`Created service: ${config.serviceName}`);

            // Create ingress
            const baseDomain = process.env.K8S_INGRESS_DOMAIN || 'localhost';
            const port = process.env.K8S_INGRESS_PORT || '80';

            const ingress: k8s.V1Ingress = {
                apiVersion: 'networking.k8s.io/v1',
                kind: 'Ingress',
                metadata: {
                    name: `${config.podName}-ingress`,
                    namespace: config.namespace,
                    labels: {
                        'app.letushack.com/component': 'os-container',
                        'app.letushack.com/os-type': config.osType,
                    },
                    annotations: {
                        'nginx.ingress.kubernetes.io/rewrite-target': '/$2',
                        'nginx.ingress.kubernetes.io/use-regex': 'true',
                        'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
                        // WebSocket support for VNC
                        'nginx.ingress.kubernetes.io/proxy-read-timeout': '3600',
                        'nginx.ingress.kubernetes.io/proxy-send-timeout': '3600',
                        'nginx.ingress.kubernetes.io/proxy-connect-timeout': '3600',
                        'nginx.ingress.kubernetes.io/websocket-services': config.serviceName,
                        'nginx.ingress.kubernetes.io/proxy-buffering': 'off',
                    },
                },
                spec: {
                    ingressClassName: 'nginx',
                    rules: [{
                        host: baseDomain,
                        http: {
                            paths: [{
                                path: `/${userSlug}/os/${config.osType}(/|$)(.*)`,
                                pathType: 'ImplementationSpecific',
                                backend: {
                                    service: {
                                        name: config.serviceName,
                                        port: { number: 80 },
                                    },
                                },
                            }],
                        },
                    }],
                },
            };

            await this.networkingApi.createNamespacedIngress({ namespace: config.namespace, body: ingress });
            console.log(`Created ingress for OS container`);

            // Wait for pod to be ready
            console.log(`⏳ Waiting for OS pod ${config.podName} to be ready...`);
            await this.waitForPodReady(config.namespace, config.podName, 90000);
            console.log(`✓ OS pod ${config.podName} is ready`);

            // Give ingress controller time to propagate routing rules
            console.log(`⏳ Waiting for ingress routing to propagate...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log(`✓ Ingress routing ready`);

            // Construct URLs
            const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
            const portSuffix = (protocol === 'https' && port === '443') || (protocol === 'http' && port === '80')
                ? ''
                : `:${port}`;

            const baseUrl = `${protocol}://${baseDomain}${portSuffix}/${userSlug}/os/${config.osType}/`;
            const url = `${baseUrl}vnc.html?autoconnect=true&resize=scale&password=debian&path=websockify`;
            const vncUrl = `${baseUrl}vnc.html?autoconnect=true&password=debian`;

            // Store in database
            await this.storeK8sOSInfo({
                podName: config.podName,
                namespace: config.namespace,
                userId: config.userId,
                osType: config.osType,
                status: 'running',
                url: baseUrl,
                createdAt: new Date(),
            });

            return {
                success: true,
                url,
                vncUrl,
            };
        } catch (error) {
            console.error('Error deploying OS pod:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Delete OS pod and cleanup resources
     */
    public async deleteOSPod(namespace: string, podName: string): Promise<{
        success: boolean;
        error?: string;
    }> {
        if (!this.k8sEnabled) {
            return { success: false, error: 'Kubernetes backend is not enabled' };
        }

        try {
            console.log(`Deleting OS resources for pod: ${podName} in namespace: ${namespace}`);

            // Get OS type from database to find all related resources
            const osInfo = await pool.query(
                'SELECT os_type FROM active_k8s_os_containers WHERE pod_name = $1',
                [podName]
            );
            const osType = osInfo.rows[0]?.os_type;

            // Delete deployment
            try {
                await this.appsApi.deleteNamespacedDeployment({ name: podName, namespace });
                console.log(`Deleted OS deployment: ${podName}`);
            } catch (err: any) {
                if (err.statusCode !== 404) {
                    console.error('Error deleting OS deployment:', err.message);
                }
            }

            // Delete services with matching OS type
            if (osType) {
                try {
                    const services = await this.k8sApi.listNamespacedService({ namespace });
                    for (const service of services.items) {
                        const svcOSType = service.metadata?.labels?.['app.letushack.com/os-type'];
                        if (svcOSType === osType) {
                            await this.k8sApi.deleteNamespacedService({
                                name: service.metadata?.name || '',
                                namespace
                            });
                            console.log(`Deleted OS service: ${service.metadata?.name}`);
                        }
                    }
                } catch (err: any) {
                    if (err.statusCode !== 404) {
                        console.error('Error deleting OS services:', err.message);
                    }
                }

                // Delete ingresses with matching OS type
                try {
                    const ingresses = await this.networkingApi.listNamespacedIngress({ namespace });
                    for (const ingress of ingresses.items) {
                        const ingressOSType = ingress.metadata?.labels?.['app.letushack.com/os-type'];
                        if (ingressOSType === osType) {
                            await this.networkingApi.deleteNamespacedIngress({
                                name: ingress.metadata?.name || '',
                                namespace
                            });
                            console.log(`Deleted OS ingress: ${ingress.metadata?.name}`);
                        }
                    }
                } catch (err: any) {
                    if (err.statusCode !== 404) {
                        console.error('Error deleting OS ingresses:', err.message);
                    }
                }
            }

            // Cleanup database record
            await this.removeK8sOSInfo(podName);

            return { success: true };
        } catch (error) {
            console.error('Error deleting OS pod:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Get OS pod status
     */
    public async getOSPodStatus(namespace: string, podName: string): Promise<{
        success: boolean;
        status?: 'running' | 'pending' | 'stopped' | 'error';
        error?: string;
    }> {
        if (!this.k8sEnabled) {
            return { success: false, error: 'Kubernetes backend is not enabled' };
        }

        try {
            const pods = await this.k8sApi.listNamespacedPod({
                namespace,
                labelSelector: `app.letushack.com/component=os-container`,
            });

            if (pods.items.length === 0) {
                return { success: true, status: 'stopped' };
            }

            const pod = pods.items[0];
            const phase = pod.status?.phase?.toLowerCase();

            let status: 'running' | 'pending' | 'stopped' | 'error';
            if (phase === 'running') {
                status = 'running';
            } else if (phase === 'pending') {
                status = 'pending';
            } else if (phase === 'failed' || phase === 'unknown') {
                status = 'error';
            } else {
                status = 'stopped';
            }

            return { success: true, status };
        } catch (error) {
            console.error('Error getting OS pod status:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Get active K8s OS containers for a user
     */
    public async getUserActiveK8sOSContainers(userId: string): Promise<{
        podName: string;
        namespace: string;
        userId: string;
        osType: string;
        status: string;
        url?: string;
        createdAt: Date;
    }[]> {
        try {
            const result = await pool.query(
                'SELECT * FROM active_k8s_os_containers WHERE user_id = $1',
                [userId]
            );

            return result.rows.map(row => ({
                podName: row.pod_name,
                namespace: row.namespace,
                userId: row.user_id,
                osType: row.os_type,
                status: row.status,
                url: row.url,
                createdAt: new Date(row.created_at),
            }));
        } catch (error) {
            console.error('Error fetching K8s OS containers:', error);
            return [];
        }
    }

    private getOSImageName(osType: string): string {
        const imageMap: Record<string, string> = {
            debian: 'os-container-single-port:latest',
        };
        return imageMap[osType] || 'os-container-single-port:latest';
    }

    private async storeK8sOSInfo(info: {
        podName: string;
        namespace: string;
        userId: string;
        osType: string;
        status: string;
        url?: string;
        createdAt: Date;
    }): Promise<void> {
        await pool.query(
            `INSERT INTO active_k8s_os_containers (pod_name, namespace, user_id, os_type, status, url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (pod_name) DO UPDATE 
       SET status = $5, updated_at = NOW()`,
            [info.podName, info.namespace, info.userId, info.osType, info.status, info.url, info.createdAt]
        );
    }

    private async removeK8sOSInfo(podName: string): Promise<void> {
        await pool.query('DELETE FROM active_k8s_os_containers WHERE pod_name = $1', [podName]);
    }
}

export const k8sService = KubernetesService.getInstance();
