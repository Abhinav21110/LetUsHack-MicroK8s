#!/bin/bash
set -e

echo "========================================"
echo "  LetUsHack LOCAL Kubernetes + Calico  "
echo "========================================"
echo ""
echo "This script sets up a local Kubernetes cluster with Calico"
echo "using kind (Kubernetes in Docker) for testing K8s features."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker Desktop first."
    exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "⚠️  kubectl not found. Installing kubectl..."
    
    # Detect OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install kubectl
        else
            echo "Please install kubectl manually from: https://kubernetes.io/docs/tasks/tools/"
            exit 1
        fi
    else
        # Linux
        curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
        chmod +x kubectl
        sudo mv kubectl /usr/local/bin/
    fi
fi

echo "✅ kubectl is installed"

# Check if kind is installed
if ! command -v kind &> /dev/null; then
    echo "⚠️  kind not found. Installing kind..."
    
    # Detect OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install kind
        else
            curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-darwin-amd64
            chmod +x ./kind
            sudo mv ./kind /usr/local/bin/kind
        fi
    else
        # Linux
        curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
        chmod +x ./kind
        sudo mv ./kind /usr/local/bin/kind
    fi
fi

echo "✅ kind is installed"
echo ""

# Create kind cluster configuration
echo "Step 1: Creating kind cluster configuration..."
echo "------------------------------------"

cat > /tmp/kind-config.yaml <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: letushack-local
networking:
  disableDefaultCNI: true  # We'll install Calico
  podSubnet: "192.168.0.0/16"  # Calico default
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 8100
    hostPort: 8100
    protocol: TCP
EOF

echo "✅ Configuration created"
echo ""

# Create kind cluster
echo "Step 2: Creating kind cluster..."
echo "------------------------------------"

if kind get clusters | grep -q "letushack-local"; then
    echo "⚠️  Cluster 'letushack-local' already exists."
    read -p "Do you want to delete and recreate it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kind delete cluster --name letushack-local
        kind create cluster --config /tmp/kind-config.yaml
    fi
else
    kind create cluster --config /tmp/kind-config.yaml
fi

echo "✅ Kind cluster created"
echo ""

# Install Calico
echo "Step 3: Installing Calico CNI..."
echo "------------------------------------"

kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.27.0/manifests/calico.yaml

echo "Waiting for Calico to be ready..."
kubectl wait --for=condition=ready pod -l k8s-app=calico-node -n kube-system --timeout=300s

echo "✅ Calico installed successfully"
echo ""

# Install NGINX Ingress Controller
echo "Step 4: Installing NGINX Ingress Controller..."
echo "------------------------------------"

kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

echo "Waiting for Ingress Controller to be ready..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s

echo "✅ Ingress Controller installed"
echo ""

# Create letushack namespace
echo "Step 5: Creating letushack namespace..."
echo "------------------------------------"

kubectl create namespace letushack-local --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace letushack-local app.letushack.com/tenant=platform --overwrite

echo "✅ Platform namespace created"
echo ""

# Apply Calico policies
echo "Step 6: Applying Calico NetworkPolicies..."
echo "------------------------------------"

if [ -f "k8s/policies/global-isolation.yaml" ]; then
    kubectl apply -f k8s/policies/global-isolation.yaml
    echo "✅ Global isolation policies applied"
else
    echo "⚠️  Global policy file not found, skipping..."
fi

echo ""
echo "========================================"
echo "  ✅ Local Kubernetes Setup Complete!  "
echo "========================================"
echo ""
echo "Your local Kubernetes cluster is ready!"
echo ""
echo "Configuration:"
echo "  - Cluster: kind (letushack-local)"
echo "  - Calico CNI: Installed"
echo "  - Ingress Controller: Port 8100"
echo "  - Platform Namespace: letushack-local"
echo "  - Global Isolation: Enabled"
echo ""
echo "Next steps:"
echo "  1. Update .env.local:"
echo "     LAB_BACKEND=kubernetes"
echo ""
echo "  2. Initialize K8s database tables:"
echo "     psql -U postgres -d letushack_db -f scripts/init-k8s-tables.sql"
echo ""
echo "  3. Start your Next.js app:"
echo "     npm run dev"
echo ""
echo "  4. Test K8s labs at:"
echo "     http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  - View cluster info: kubectl cluster-info"
echo "  - View nodes: kubectl get nodes"
echo "  - View pods: kubectl get pods -A"
echo "  - Delete cluster: kind delete cluster --name letushack-local"
echo ""
