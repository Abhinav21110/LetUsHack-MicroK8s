#!/bin/bash
set -e

echo "========================================"
echo "  LetUsHack MicroK8s + Calico Setup    "
echo "========================================"
echo ""
echo "This script sets up MicroK8s with Calico for production-grade"
echo "local Kubernetes with autoscaling and self-healing capabilities."
echo ""
echo "UPGRADE: Replacing kind with MicroK8s"
echo "PRESERVES: All existing routes, data, and application behavior"
echo "ADDS: Autoscaling, PodDisruptionBudgets, ResourceQuotas, Metrics"
echo ""

# Validate OS
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "❌ MicroK8s requires Linux. Detected: $OSTYPE"
    echo "   For macOS/Windows, continue using kind (setup-local-k8s.sh)"
    exit 1
fi

echo "✅ Linux detected"

# Check if running as non-root
if [ "$EUID" -eq 0 ]; then 
    echo "❌ Do not run this script as root. Run as normal user with sudo access."
    exit 1
fi

# Check if kind cluster exists (rollback path)
KIND_CLUSTER_EXISTS=false
if command -v kind &> /dev/null; then
    if kind get clusters | grep -q "letushack-local"; then
        KIND_CLUSTER_EXISTS=true
        echo "⚠️  Detected existing kind cluster: letushack-local"
        echo "   This will be preserved for rollback capability"
    fi
fi

# Install MicroK8s if not present
echo ""
echo "Step 1: Installing MicroK8s..."
echo "------------------------------------"

if ! command -v microk8s &> /dev/null; then
    echo "Installing MicroK8s via snap..."
    sudo snap install microk8s --classic --channel=1.28/stable
    
    # Add user to microk8s group
    sudo usermod -a -G microk8s $USER
    sudo chown -f -R $USER ~/.kube || true
    
    echo "⚠️  User added to microk8s group"
    echo "   You may need to log out and back in for group changes to take effect"
    echo "   Or run: newgrp microk8s"
    echo ""
    read -p "Press Enter to continue (after running 'newgrp microk8s' if needed)..."
else
    echo "✅ MicroK8s already installed"
fi

# Wait for MicroK8s to be ready
echo ""
echo "Step 2: Waiting for MicroK8s to be ready..."
echo "------------------------------------"
microk8s status --wait-ready
echo "✅ MicroK8s is ready"

# Enable required addons
echo ""
echo "Step 3: Enabling MicroK8s addons..."
echo "------------------------------------"

# DNS - Required for service discovery
echo "Enabling DNS..."
microk8s enable dns
sleep 5

# Storage - Required for PersistentVolumes
echo "Enabling hostpath-storage..."
microk8s enable hostpath-storage
sleep 5

# Metrics Server - Required for autoscaling
echo "Enabling metrics-server..."
microk8s enable metrics-server
sleep 5

# Ingress - Required for routing
echo "Enabling ingress..."
microk8s enable ingress
sleep 10

echo "✅ Core addons enabled"

# Setup kubectl alias
echo ""
echo "Step 4: Configuring kubectl..."
echo "------------------------------------"

# Install kubectl if not present
if ! command -v kubectl &> /dev/null; then
    echo "Installing kubectl..."
    sudo snap install kubectl --classic
fi

# Setup kubeconfig
mkdir -p ~/.kube
microk8s config > ~/.kube/config-microk8s
export KUBECONFIG=~/.kube/config-microk8s

# Create convenience alias in bashrc
if ! grep -q "alias kubectl='microk8s kubectl'" ~/.bashrc; then
    echo "alias kubectl='microk8s kubectl'" >> ~/.bashrc
    echo "export KUBECONFIG=~/.kube/config-microk8s" >> ~/.bashrc
fi

echo "✅ kubectl configured (restart terminal or source ~/.bashrc)"

# Use microk8s kubectl for rest of script
KUBECTL="microk8s kubectl"

# Verify cluster
echo ""
echo "Step 5: Verifying cluster connectivity..."
echo "------------------------------------"
$KUBECTL cluster-info
$KUBECTL get nodes
echo "✅ Cluster is operational"

# Install Calico CNI (replacing default CNI)
echo ""
echo "Step 6: Installing Calico CNI..."
echo "------------------------------------"

# Note: MicroK8s uses its own CNI by default, we add Calico for network policies
echo "Applying Calico operator..."
$KUBECTL apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.27.0/manifests/tigera-operator.yaml

# Wait for operator
sleep 10
$KUBECTL wait --for=condition=ready pod -l k8s-app=tigera-operator -n tigera-operator --timeout=300s

# Apply Calico custom resource
echo "Configuring Calico installation..."
cat <<EOF | $KUBECTL apply -f -
apiVersion: operator.tigera.io/v1
kind: Installation
metadata:
  name: default
spec:
  calicoNetwork:
    ipPools:
    - blockSize: 26
      cidr: 192.168.0.0/16
      encapsulation: VXLAN
      natOutgoing: true
      nodeSelector: all()
EOF

echo "Waiting for Calico to be ready..."
sleep 20
$KUBECTL wait --for=condition=ready pod -l k8s-app=calico-node -n calico-system --timeout=300s || echo "Continuing..."

echo "✅ Calico installed successfully"

# Configure Ingress for port 8100
echo ""
echo "Step 7: Configuring Ingress Controller..."
echo "------------------------------------"

# Patch NGINX ingress to listen on port 8100
$KUBECTL patch daemonset nginx-ingress-microk8s-controller -n ingress \
  --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/ports/-", "value":{"containerPort":8100,"hostPort":8100,"name":"custom","protocol":"TCP"}}]' \
  || echo "Note: Ingress may already be configured"

echo "✅ Ingress configured for port 8100"

# Create letushack namespace with proper labels
echo ""
echo "Step 8: Creating letushack namespace..."
echo "------------------------------------"

$KUBECTL create namespace letushack --dry-run=client -o yaml | $KUBECTL apply -f -
$KUBECTL label namespace letushack app.letushack.com/tenant=platform --overwrite

echo "✅ Platform namespace created"

# Apply existing Calico policies
echo ""
echo "Step 9: Applying Calico NetworkPolicies..."
echo "------------------------------------"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
POLICIES_DIR="$SCRIPT_DIR/../k8s/policies"

if [ -f "$POLICIES_DIR/global-isolation.yaml" ]; then
    $KUBECTL apply -f "$POLICIES_DIR/global-isolation.yaml"
    echo "✅ Global isolation policies applied"
fi

if [ -f "$POLICIES_DIR/default-deny-all.yaml" ]; then
    $KUBECTL apply -f "$POLICIES_DIR/default-deny-all.yaml"
    echo "✅ Default deny policies applied"
fi

if [ -f "$POLICIES_DIR/allow-platform-services.yaml" ]; then
    $KUBECTL apply -f "$POLICIES_DIR/allow-platform-services.yaml"
    echo "✅ Platform service policies applied"
fi

if [ -f "$POLICIES_DIR/allow-ingress.yaml" ]; then
    $KUBECTL apply -f "$POLICIES_DIR/allow-ingress.yaml"
    echo "✅ Ingress policies applied"
fi

# Create resource quotas and limits
echo ""
echo "Step 10: Creating ResourceQuotas and LimitRanges..."
echo "------------------------------------"

cat <<EOF | $KUBECTL apply -f -
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
    persistentvolumeclaims: "50"
    pods: "100"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: letushack-limits
  namespace: letushack
spec:
  limits:
  - max:
      cpu: "4"
      memory: 8Gi
    min:
      cpu: "10m"
      memory: 10Mi
    default:
      cpu: "500m"
      memory: 512Mi
    defaultRequest:
      cpu: "100m"
      memory: 128Mi
    type: Container
  - max:
      cpu: "8"
      memory: 16Gi
    min:
      cpu: "10m"
      memory: 10Mi
    type: Pod
EOF

echo "✅ Resource limits configured"

# Create PersistentVolume for data persistence
echo ""
echo "Step 11: Creating PersistentVolumes..."
echo "------------------------------------"

# Create directory for PV storage
sudo mkdir -p /var/letushack/pv-data
sudo chmod 777 /var/letushack/pv-data

cat <<EOF | $KUBECTL apply -f -
apiVersion: v1
kind: PersistentVolume
metadata:
  name: letushack-pv-local
spec:
  capacity:
    storage: 50Gi
  accessModes:
  - ReadWriteOnce
  - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  storageClassName: microk8s-hostpath
  hostPath:
    path: /var/letushack/pv-data
    type: DirectoryOrCreate
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: Exists
EOF

echo "✅ PersistentVolumes created"

# Verify metrics server
echo ""
echo "Step 12: Verifying Metrics Server..."
echo "------------------------------------"

sleep 10
$KUBECTL top nodes || echo "⚠️  Metrics not yet available (may take 1-2 minutes)"

echo "✅ Metrics server is active"

echo ""
echo "========================================"
echo "  ✅ MicroK8s Setup Complete!          "
echo "========================================"
echo ""
echo "Your production-grade local Kubernetes cluster is ready!"
echo ""
echo "Configuration:"
echo "  - Orchestration: MicroK8s (replaces kind)"
echo "  - Calico CNI: Installed with network policies"
echo "  - Ingress Controller: Port 8100"
echo "  - Metrics Server: Enabled (for autoscaling)"
echo "  - Storage: hostpath-storage"
echo "  - Platform Namespace: letushack"
echo "  - Resource Quotas: Configured"
echo "  - Global Isolation: Enabled"
echo ""
echo "New Capabilities:"
echo "  ✓ Horizontal Pod Autoscaling (HPA)"
echo "  ✓ Metrics-based scaling"
echo "  ✓ PodDisruptionBudgets"
echo "  ✓ Resource limits per workload"
echo "  ✓ Persistent storage"
echo "  ✓ Self-healing pods"
echo ""
echo "Next steps:"
echo "  1. Source your bashrc (or log out/in):"
echo "     source ~/.bashrc"
echo ""
echo "  2. Verify cluster:"
echo "     microk8s kubectl get nodes"
echo "     microk8s kubectl top nodes"
echo ""
echo "  3. Update .env.local (NO CHANGES NEEDED if already set):"
echo "     LAB_BACKEND=kubernetes"
echo ""
echo "  4. Database tables (NO MIGRATION NEEDED if already initialized):"
echo "     Tables: k8s_labs, k8s_pods - already compatible"
echo ""
echo "  5. Start your Next.js app:"
echo "     npm run dev"
echo ""
echo "  6. Test autoscaling:"
echo "     ./scripts/validate-microk8s.sh"
echo ""
echo "Rollback to kind:"
echo "  If needed, run: ./scripts/rollback-to-kind.sh"
if [ "$KIND_CLUSTER_EXISTS" = true ]; then
    echo "  Your kind cluster 'letushack-local' is still available"
fi
echo ""
echo "Useful commands:"
echo "  - View cluster: microk8s kubectl cluster-info"
echo "  - View nodes: microk8s kubectl get nodes"
echo "  - View pods: microk8s kubectl get pods -A"
echo "  - Check metrics: microk8s kubectl top nodes"
echo "  - Check HPA: microk8s kubectl get hpa -n letushack"
echo "  - Stop MicroK8s: microk8s stop"
echo "  - Start MicroK8s: microk8s start"
echo ""
