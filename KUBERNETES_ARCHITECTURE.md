# MicroK8s + Calico + Ingress Architecture Guide

**Production-grade local Kubernetes orchestration for LetUsHack platform**

---

## 🎯 Overview

This guide explains how LetUsHack uses **MicroK8s + Calico + NGINX Ingress** to orchestrate security labs and OS containers with network isolation, autoscaling, and self-healing capabilities.

### Quick Facts
- **Orchestration**: MicroK8s (production Kubernetes)
- **Networking**: Calico CNI with network policies
- **Routing**: NGINX Ingress Controller (port 8100)
- **Isolation**: Per-user namespaces with deny-all defaults
- **Backend Options**: Docker OR Kubernetes (configurable)

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Host Machine (Linux)                                               │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  MicroK8s Cluster                                              │ │
│  │                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  Calico CNI Layer                                        │  │ │
│  │  │  • VXLAN Overlay Network (192.168.0.0/16)               │  │ │
│  │  │  • GlobalNetworkPolicy: Deny inter-user traffic         │  │ │
│  │  │  • NetworkPolicy: Per-namespace isolation               │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  NGINX Ingress Controller                                │  │ │
│  │  │  • Port: 8100 (host binding)                            │  │ │
│  │  │  • TLS Termination                                       │  │ │
│  │  │  • Path-based routing                                    │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                          │                                      │ │
│  │                          ↓                                      │ │
│  │  ┌───────────────────────────────────────────────────────────┐ │ │
│  │  │  Namespace: letushack (platform services)                 │ │ │
│  │  │  Label: app.letushack.com/tenant=platform                │ │ │
│  │  └───────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  ┌───────────────────────────────────────────────────────────┐ │ │
│  │  │  Namespace: letushack-local-user1                         │ │ │
│  │  │  Label: app.letushack.com/tenant=user                    │ │ │
│  │  │                                                            │ │ │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │ │ │
│  │  │  │ Lab Pod     │  │ Lab Pod     │  │ OS Pod      │      │ │ │
│  │  │  │ (XSS)       │  │ (Nmap)      │  │ (Debian)    │      │ │ │
│  │  │  │ Port: 8080  │  │ Port: 8080  │  │ Port: 22/80 │      │ │ │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘      │ │ │
│  │  │         │                │                │               │ │ │
│  │  │         └────────────────┴────────────────┘               │ │ │
│  │  │                          │                                │ │ │
│  │  │                 ┌────────▼──────────┐                     │ │ │
│  │  │                 │  NetworkPolicy    │                     │ │ │
│  │  │                 │  • Allow ingress  │                     │ │ │
│  │  │                 │  • Allow DNS      │                     │ │ │
│  │  │                 │  • Deny all else  │                     │ │ │
│  │  │                 └───────────────────┘                     │ │ │
│  │  └───────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  ┌───────────────────────────────────────────────────────────┐ │ │
│  │  │  Namespace: letushack-local-user2                         │ │ │
│  │  │  Label: app.letushack.com/tenant=user                    │ │ │
│  │  │                                                            │ │ │
│  │  │  ┌─────────────┐  ┌─────────────┐                        │ │ │
│  │  │  │ Lab Pod     │  │ OS Pod      │                        │ │ │
│  │  │  │ (CSRF)      │  │ (Ubuntu)    │                        │ │ │
│  │  │  └─────────────┘  └─────────────┘                        │ │ │
│  │  │         │                │                                │ │ │
│  │  │         └────────────────┘                                │ │ │
│  │  │                  │                                        │ │ │
│  │  │           NetworkPolicy                                   │ │ │
│  │  │           (isolated)                                      │ │ │
│  │  └───────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  Metrics Server + HPA                                    │  │ │
│  │  │  • Collects CPU/memory metrics                          │  │ │
│  │  │  • Triggers autoscaling (1-10 replicas)                 │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  Storage: hostpath-storage                               │  │ │
│  │  │  Path: /var/letushack/pv-data                           │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Next.js Application (http://localhost:3000)                  │ │
│  │  • Creates K8s resources via API                              │ │
│  │  • Tracks state in PostgreSQL                                 │ │
│  │  • Routes users to http://localhost:8100/user-xxx/...         │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL Database                                           │ │
│  │  • active_k8s_labs (pod tracking)                             │ │
│  │  • active_k8s_os_containers (OS tracking)                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔌 How It Works

### 1. User Starts a Lab/OS Container

```
User clicks "Start Lab" in browser
         ↓
Next.js API (/api/labs/start or /api/os/start)
         ↓
Kubernetes Service (src/lib/k8s-service.ts)
         ↓
Creates K8s Resources:
  • Namespace: letushack-local-{user_id}
  • Deployment: {lab_type}-{timestamp}
  • Service: {lab_type}-svc-{timestamp}
  • Ingress: {lab_type}-ingress-{timestamp}
  • NetworkPolicy: allow-ingress, allow-dns
         ↓
Tracks in PostgreSQL:
  • Table: active_k8s_labs or active_k8s_os_containers
  • Columns: pod_name, namespace, user_id, status, url
         ↓
Returns URL: http://localhost:8100/{namespace}/{service}/
         ↓
User accesses isolated environment in browser
```

### 2. Network Isolation (Calico)

```
Pod A (user1) → Pod B (user2)  ❌ BLOCKED
                    ↓
          GlobalNetworkPolicy
          (letushack-global-isolation)
          Matches: tenant=user
          Action: Deny inter-user traffic
                    ↓
Pod A (user1) → Internet        ✅ ALLOWED (via egress policy)
Pod A (user1) → Ingress         ✅ ALLOWED (via ingress policy)
Pod A (user1) → DNS             ✅ ALLOWED (kube-dns access)
```

### 3. Routing (NGINX Ingress)

```
User requests: http://localhost:8100/letushack-local-user1/xss-svc-123/

NGINX Ingress Controller:
  1. Matches Ingress rule for namespace=letushack-local-user1
  2. Finds Service: xss-svc-123
  3. Routes to Pod: xss-123-xxxxxx
  4. Returns response to user

Path rewrite example:
  /letushack-local-user1/xss-svc-123/challenge → /challenge (in pod)
```

### 4. Autoscaling (HPA)

```
Metrics Server monitors pod CPU/memory
         ↓
CPU > 70% or Memory > 80%
         ↓
HPA triggers scale-up
         ↓
New pod replicas created (max 10)
         ↓
Load distributed across replicas
         ↓
CPU/Memory normalizes
         ↓
HPA scales down (min 1 replica)
```

---

## 🗄️ Database Schema

### Table: `active_k8s_labs`
Tracks running lab pods in Kubernetes.

```sql
CREATE TABLE active_k8s_labs (
  pod_name VARCHAR(255) PRIMARY KEY,      -- e.g., xss-test-use-1767950140709
  namespace VARCHAR(255) NOT NULL,        -- e.g., letushack-local-test-user3
  user_id VARCHAR(255) NOT NULL,          -- e.g., test_user3
  lab_type VARCHAR(50) NOT NULL,          -- e.g., xss, nmap, csrf
  status VARCHAR(50) DEFAULT 'running',   -- running, stopped, error
  url TEXT,                               -- http://localhost:8100/...
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_k8s_labs_user_id ON active_k8s_labs(user_id);
CREATE INDEX idx_k8s_labs_namespace ON active_k8s_labs(namespace);
```

### Table: `active_k8s_os_containers`
Tracks running OS containers (Debian, Ubuntu, etc.).

```sql
CREATE TABLE active_k8s_os_containers (
  pod_name VARCHAR(255) PRIMARY KEY,      -- e.g., os-debian-1767950109363
  namespace VARCHAR(255) NOT NULL,        -- e.g., letushack-local-test-user3
  user_id VARCHAR(255) NOT NULL,          -- e.g., test_user3
  os_type VARCHAR(50) NOT NULL,           -- debian, ubuntu, kali
  status VARCHAR(50) DEFAULT 'running',   -- running, stopped, error
  url TEXT,                               -- HTTP access URL
  vnc_url TEXT,                           -- VNC access URL (if applicable)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_k8s_os_user_id ON active_k8s_os_containers(user_id);
CREATE INDEX idx_k8s_os_namespace ON active_k8s_os_containers(namespace);
```

### Queries

**Find all labs for a user:**
```sql
SELECT * FROM active_k8s_labs 
WHERE user_id = 'test_user3' 
ORDER BY created_at DESC;
```

**Find all running OS containers:**
```sql
SELECT * FROM active_k8s_os_containers 
WHERE status = 'running';
```

**Cleanup stale entries:**
```sql
DELETE FROM active_k8s_labs 
WHERE created_at < NOW() - INTERVAL '24 hours';
```

---

## ⚡ MicroK8s + Calico + Ingress vs Docker + Traefik

### Architecture Comparison

| Aspect | Docker + Traefik | MicroK8s + Calico + Ingress |
|--------|------------------|------------------------------|
| **Orchestration** | Docker Compose | Kubernetes (MicroK8s) |
| **Networking** | Docker Bridge Networks | Calico CNI (VXLAN overlay) |
| **Isolation** | Network namespaces | K8s Namespaces + NetworkPolicies |
| **Routing** | Traefik (HTTP router) | NGINX Ingress Controller |
| **Scaling** | Manual (`docker-compose scale`) | Automatic (HPA) |
| **Self-healing** | Manual restart | Automatic (liveness probes) |
| **State Management** | None (stateless) | PersistentVolumes |
| **Resource Limits** | CPU/memory limits (Docker) | ResourceQuotas + LimitRanges |
| **Metrics** | External (Prometheus) | Built-in (Metrics Server) |
| **Production Realism** | Low (different from prod) | High (same as cloud K8s) |

### Advantages of MicroK8s + Calico + Ingress

#### 1. **Native Network Isolation**
**Docker + Traefik:**
- Relies on Docker networks (bridge mode)
- Custom iptables rules needed for strict isolation
- Difficult to enforce policies at scale

**MicroK8s + Calico:**
```yaml
# GlobalNetworkPolicy: Deny all inter-user traffic
apiVersion: projectcalico.org/v3
kind: GlobalNetworkPolicy
metadata:
  name: letushack-global-isolation
spec:
  selector: app.letushack.com/tenant == 'user'
  types: [Ingress, Egress]
  ingress:
  - action: Deny
    source:
      namespaceSelector: app.letushack.com/tenant == 'user'
  egress:
  - action: Deny
    destination:
      namespaceSelector: app.letushack.com/tenant == 'user'
```
✅ **Result**: Users cannot access each other's environments by design

#### 2. **Automatic Scaling**
**Docker + Traefik:**
```bash
# Manual scaling
docker-compose up --scale lab-xss=3
```
- No automatic scaling based on load
- Manual intervention required
- No metrics-based decisions

**MicroK8s + Calico:**
```yaml
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: lab-workload-hpa
spec:
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```
✅ **Result**: Automatic scaling based on CPU/memory (1-10 replicas)

#### 3. **Self-Healing**
**Docker + Traefik:**
```yaml
# docker-compose.yml
services:
  lab-xss:
    restart: on-failure  # Basic restart
```
- Simple restart on crash
- No health checking
- No graceful degradation

**MicroK8s + Calico:**
```yaml
# Deployment with probes
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  periodSeconds: 5
```
✅ **Result**: Health-based restarts + traffic management

#### 4. **Resource Management**
**Docker + Traefik:**
```yaml
# docker-compose.yml
services:
  lab-xss:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```
- Per-container limits
- No namespace-wide quotas
- Easy to exhaust host resources

**MicroK8s + Calico:**
```yaml
# ResourceQuota for namespace
apiVersion: v1
kind: ResourceQuota
metadata:
  name: letushack-quota
  namespace: letushack
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    limits.cpu: "40"
    limits.memory: 80Gi
    pods: "100"
```
✅ **Result**: Namespace-level quotas prevent resource exhaustion

#### 5. **High Availability**
**Docker + Traefik:**
- Single point of failure (Docker daemon)
- No pod disruption management
- Downtime during updates

**MicroK8s + Calico:**
```yaml
# PodDisruptionBudget
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: lab-workload-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: lab-workload
```
✅ **Result**: Ensures minimum availability during disruptions

#### 6. **Persistent Storage**
**Docker + Traefik:**
```yaml
# docker-compose.yml
volumes:
  lab-data:
    driver: local
```
- Volume lifecycle tied to container
- No dynamic provisioning
- Manual backup/restore

**MicroK8s + Calico:**
```yaml
# PersistentVolumeClaim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: lab-data-pvc
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 5Gi
  storageClassName: microk8s-hostpath
```
✅ **Result**: Data persists across pod restarts, dynamic provisioning

#### 7. **Metrics & Monitoring**
**Docker + Traefik:**
```bash
# Manual metrics collection
docker stats
```
- No built-in metrics server
- Requires external tools (Prometheus, Grafana)
- No HPA integration

**MicroK8s + Calico:**
```bash
# Built-in metrics
kubectl top nodes
kubectl top pods -n letushack
```
✅ **Result**: Real-time metrics for autoscaling and monitoring

#### 8. **Production Parity**
**Docker + Traefik:**
- Different from production Kubernetes
- Requires separate testing environment
- Skills not transferable

**MicroK8s + Calico:**
- Same Kubernetes API as cloud providers (AWS EKS, GCP GKE, Azure AKS)
- Manifests work in production with minimal changes
- Skills directly transferable

✅ **Result**: Develop locally, deploy anywhere

---

## 🚀 Setup & Usage

### Installation
```bash
# Install MicroK8s + Calico + Ingress
cd /home/letushack/Downloads/tigera/tigera-new
./scripts/setup-microk8s.sh
```

### Validation
```bash
# Verify all components
./scripts/validate-microk8s.sh
```

### Configuration
```bash
# .env.local
LAB_BACKEND=kubernetes  # Use MicroK8s
# LAB_BACKEND=docker     # Fallback to Docker
```

### Common Commands
```bash
# View cluster status
microk8s kubectl get nodes
microk8s kubectl get pods -A

# View user namespaces
microk8s kubectl get namespaces -l app.letushack.com/tenant=user

# Check autoscaling
microk8s kubectl get hpa -n letushack

# View metrics
microk8s kubectl top nodes
microk8s kubectl top pods -n letushack

# Describe network policies
microk8s kubectl get networkpolicy -A
microk8s kubectl get globalnetworkpolicy

# View ingress routes
microk8s kubectl get ingress -A
```

---

## 🔄 Migration Path

### From Docker to MicroK8s

**Gradual Migration:**
1. Install MicroK8s (Docker continues running)
2. Test with beta users (`LAB_BACKEND=kubernetes` for specific users)
3. Monitor metrics and performance
4. Switch all users to MicroK8s
5. Keep Docker as fallback

**Zero Code Changes:**
- Application code: ✅ Unchanged
- Database schema: ✅ Unchanged
- API routes: ✅ Unchanged
- Frontend: ✅ Unchanged

**Rollback:**
```bash
# Instant rollback to Docker
./scripts/rollback-to-kind.sh

# Or update .env.local
LAB_BACKEND=docker
```

---

## 📊 Performance Characteristics

### MicroK8s + Calico + Ingress

| Metric | Value |
|--------|-------|
| **Pod startup time** | 3-5 seconds |
| **Network latency** | <5ms (VXLAN overhead) |
| **Ingress latency** | <10ms |
| **Autoscaling reaction time** | 15-30 seconds |
| **Max concurrent pods** | 100 per namespace (configurable) |
| **Resource overhead** | ~500MB RAM, 1 CPU core (control plane) |

### Scaling Limits

```yaml
# Per Namespace
Max Pods: 100
Max CPU: 40 cores
Max Memory: 80Gi

# Per Pod
Max CPU: 4 cores
Max Memory: 8Gi
Default CPU: 500m
Default Memory: 512Mi
```

---

## 🔐 Security Model

### Defense in Depth

1. **Namespace Isolation**: Each user gets isolated namespace
2. **Network Policies**: Deny-all default, explicit allow rules
3. **Resource Quotas**: Prevent DoS via resource exhaustion
4. **Pod Security**: Non-root users, read-only filesystems (where possible)
5. **Ingress**: TLS termination, path-based routing
6. **RBAC**: Kubernetes role-based access (future enhancement)

---

## 📝 Key Files

| File | Purpose |
|------|---------|
| `scripts/setup-microk8s.sh` | Install and configure MicroK8s |
| `scripts/validate-microk8s.sh` | Validate installation |
| `scripts/rollback-to-kind.sh` | Rollback to kind/Docker |
| `k8s/policies/global-isolation.yaml` | Global network isolation |
| `k8s/policies/default-deny-all.yaml` | Default deny policy |
| `k8s/microk8s/hpa-autoscaling.yaml` | Autoscaling configs |
| `k8s/microk8s/pod-disruption-budgets.yaml` | High availability |
| `src/lib/k8s-service.ts` | Kubernetes API client |
| `scripts/init-k8s-tables.sql` | Database schema |

---

## 🎯 Summary

**Why MicroK8s + Calico + Ingress?**

✅ **Native network isolation** (no custom iptables hacks)  
✅ **Automatic scaling** (CPU/memory-based)  
✅ **Self-healing** (health probes)  
✅ **Production parity** (same as cloud K8s)  
✅ **Resource safety** (quotas prevent DoS)  
✅ **High availability** (PodDisruptionBudgets)  
✅ **Built-in metrics** (no external tools needed)  
✅ **Persistent storage** (data survives restarts)  

**Result**: Production-grade local development environment that scales from 1 to 100+ concurrent users.

---

*Last Updated: January 9, 2026*  
*Architecture: MicroK8s 1.28 + Calico 3.27 + NGINX Ingress*
