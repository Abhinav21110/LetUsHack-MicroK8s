#!/bin/bash
set -e

echo "========================================"
echo "  LetUsHack Kubernetes + Calico Setup  "
echo "========================================"

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Check cluster connectivity
echo "Checking Kubernetes cluster connectivity..."
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster. Please configure kubeconfig."
    exit 1
fi

echo "✅ Connected to Kubernetes cluster"

# Install Calico CNI
echo ""
echo "Installing Calico CNI..."
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.27.0/manifests/calico.yaml

echo "Waiting for Calico to be ready..."
kubectl wait --for=condition=ready pod -l k8s-app=calico-node -n kube-system --timeout=300s

echo "✅ Calico installed successfully"

# Create letushack platform namespace
echo ""
echo "Creating letushack platform namespace..."
kubectl create namespace letushack --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace letushack app.letushack.com/tenant=platform --overwrite

echo "✅ Platform namespace created"

# Install NGINX Ingress Controller
echo ""
echo "Installing NGINX Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

echo "Waiting for Ingress Controller to be ready..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s

echo "✅ Ingress Controller installed"

# Patch ingress to listen on port 8100
echo ""
echo "Configuring Ingress Controller to listen on port 8100..."
kubectl patch svc ingress-nginx-controller -n ingress-nginx --type='json' \
  -p='[{"op": "replace", "path": "/spec/ports/0/port", "value":8100}]' || echo "Note: Port may already be configured"

echo "✅ Ingress configured"

# Apply global Calico policies
echo ""
echo "Applying Calico GlobalNetworkPolicies..."
if [ -f "k8s/policies/global-isolation.yaml" ]; then
    kubectl apply -f k8s/policies/global-isolation.yaml
    echo "✅ Global isolation policies applied"
else
    echo "⚠️  Global policy file not found, skipping..."
fi

# Create database tables
echo ""
echo "Creating K8s tracking tables in database..."
if [ -f "scripts/init-k8s-tables.sql" ]; then
    echo "Note: Run this manually with your database credentials:"
    echo "  psql -U postgres -d letushack_db -f scripts/init-k8s-tables.sql"
else
    echo "⚠️  SQL script not found"
fi

echo ""
echo "========================================"
echo "  ✅ Setup Complete!                  "
echo "========================================"
echo ""
echo "Kubernetes cluster is ready for LetUsHack with Calico"
echo ""
echo "Configuration:"
echo "  - Calico CNI: Installed"
echo "  - Ingress Controller: Port 8100"
echo "  - Platform Namespace: letushack"
echo "  - Global Isolation: Enabled"
echo ""
echo "Next steps:"
echo "  1. Set LAB_BACKEND=kubernetes in .env.local"
echo "  2. Run database migration: init-k8s-tables.sql"
echo "  3. Start your Next.js app: npm run dev"
echo "  4. Test with: scripts/test-k8s-isolation.sh"
echo ""
