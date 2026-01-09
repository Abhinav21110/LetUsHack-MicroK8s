#!/bin/bash
set -e

echo "========================================"
echo "  Rollback to kind Cluster             "
echo "========================================"
echo ""
echo "This script rolls back from MicroK8s to kind"
echo "preserving all data and configuration."
echo ""

# Check if kind is installed
if ! command -v kind &> /dev/null; then
    echo "❌ kind not found. Installing kind..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install kind
        else
            curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-darwin-amd64
            chmod +x ./kind
            sudo mv ./kind /usr/local/bin/kind
        fi
    else
        curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
        chmod +x ./kind
        sudo mv ./kind /usr/local/bin/kind
    fi
fi

echo "✅ kind is installed"

# Check if kind cluster already exists
if kind get clusters | grep -q "letushack-local"; then
    echo "✅ kind cluster 'letushack-local' already exists"
    echo ""
    read -p "Do you want to recreate it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Using existing kind cluster"
    else
        echo "Deleting and recreating kind cluster..."
        kind delete cluster --name letushack-local
        
        # Create cluster using original script
        if [ -f "./scripts/setup-local-k8s.sh" ]; then
            bash ./scripts/setup-local-k8s.sh
        else
            echo "❌ setup-local-k8s.sh not found"
            exit 1
        fi
    fi
else
    echo "Creating new kind cluster..."
    
    # Create cluster using original script
    if [ -f "./scripts/setup-local-k8s.sh" ]; then
        bash ./scripts/setup-local-k8s.sh
    else
        echo "❌ setup-local-k8s.sh not found"
        exit 1
    fi
fi

# Switch kubeconfig to kind
echo ""
echo "Switching kubeconfig to kind..."
kind export kubeconfig --name letushack-local
export KUBECONFIG=~/.kube/config

echo ""
echo "========================================"
echo "  ✅ Rollback Complete                 "
echo "========================================"
echo ""
echo "You are now using kind cluster 'letushack-local'"
echo ""
echo "Configuration:"
echo "  - Orchestration: kind (Docker-in-Docker)"
echo "  - Cluster: letushack-local"
echo "  - Kubeconfig: ~/.kube/config"
echo ""
echo "Note: MicroK8s is still installed but not in use"
echo "To completely remove MicroK8s: sudo snap remove microk8s"
echo ""
echo "Next steps:"
echo "  1. Verify cluster: kubectl get nodes"
echo "  2. Start your app: npm run dev"
echo ""
echo "To switch back to MicroK8s:"
echo "  export KUBECONFIG=~/.kube/config-microk8s"
echo "  or run: ./scripts/setup-microk8s.sh"
echo ""
