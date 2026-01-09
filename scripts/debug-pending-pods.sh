#!/bin/bash
# filepath: scripts/debug-pending-pods.sh

echo "================================================"
echo "  Debugging Pending Pods in MicroK8s           "
echo "================================================"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}━━━ 1. Checking Cluster Status ━━━${NC}"
kubectl get nodes
echo ""
kubectl top nodes 2>/dev/null || echo "⚠️  Metrics not available yet"

echo ""
echo -e "${BLUE}━━━ 2. Checking All Namespaces ━━━${NC}"
kubectl get pods -A

echo ""
echo -e "${BLUE}━━━ 3. Pending Pods Detail ━━━${NC}"
PENDING_PODS=$(kubectl get pods -A --field-selector=status.phase=Pending --no-headers)

if [ -z "$PENDING_PODS" ]; then
    echo -e "${GREEN}✓ No pending pods${NC}"
else
    echo "$PENDING_PODS"
    echo ""
    
    # Get first pending pod for detailed debug
    FIRST_POD=$(echo "$PENDING_PODS" | head -1 | awk '{print $2}')
    FIRST_NS=$(echo "$PENDING_PODS" | head -1 | awk '{print $1}')
    
    echo -e "${YELLOW}Analyzing: $FIRST_NS/$FIRST_POD${NC}"
    echo ""
    
    echo "━━━ Pod Events ━━━"
    kubectl describe pod $FIRST_POD -n $FIRST_NS | grep -A 20 "Events:"
    
    echo ""
    echo "━━━ Pod Conditions ━━━"
    kubectl get pod $FIRST_POD -n $FIRST_NS -o jsonpath='{.status.conditions[*].message}' | tr ',' '\n'
fi

echo ""
echo -e "${BLUE}━━━ 4. Checking Storage Classes ━━━${NC}"
kubectl get storageclass
echo ""
kubectl get pv
echo ""
kubectl get pvc -A

echo ""
echo -e "${BLUE}━━━ 5. Checking System Pods ━━━${NC}"
kubectl get pods -n kube-system | grep -E "calico|coredns|metrics"

echo ""
echo -e "${BLUE}━━━ 6. Checking Resource Pressure ━━━${NC}"
kubectl describe nodes | grep -A 5 "Conditions:"

echo ""
echo -e "${BLUE}━━━ 7. Common Issues Check ━━━${NC}"

# Check if storage provisioner is running
STORAGE_PODS=$(kubectl get pods -n kube-system -l app=hostpath-provisioner --no-headers 2>/dev/null | wc -l)
if [ "$STORAGE_PODS" -eq 0 ]; then
    echo -e "${RED}✗ Storage provisioner not running${NC}"
    echo "  Fix: microk8s enable storage"
else
    echo -e "${GREEN}✓ Storage provisioner running${NC}"
fi

# Check if CNI is ready
CNI_PODS=$(kubectl get pods -n kube-system -l k8s-app=calico-node --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
if [ "$CNI_PODS" -eq 0 ]; then
    echo -e "${RED}✗ Calico CNI not running${NC}"
    echo "  Fix: kubectl apply -f k8s/calico/calico.yaml"
else
    echo -e "${GREEN}✓ Calico CNI running${NC}"
fi

# Check if DNS is ready
DNS_PODS=$(kubectl get pods -n kube-system -l k8s-app=kube-dns --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
if [ "$DNS_PODS" -eq 0 ]; then
    echo -e "${RED}✗ CoreDNS not running${NC}"
    echo "  Fix: microk8s enable dns"
else
    echo -e "${GREEN}✓ CoreDNS running${NC}"
fi

echo ""
echo -e "${BLUE}━━━ 8. Suggested Fixes ━━━${NC}"
echo ""

if kubectl get pods -A --field-selector=status.phase=Pending -o json | grep -q "Insufficient memory"; then
    echo -e "${YELLOW}⚠️  ISSUE: Insufficient Memory${NC}"
    echo "   Solution: Reduce pod resource requests or add more RAM"
    echo ""
fi

if kubectl get pods -A --field-selector=status.phase=Pending -o json | grep -q "Insufficient cpu"; then
    echo -e "${YELLOW}⚠️  ISSUE: Insufficient CPU${NC}"
    echo "   Solution: Reduce pod CPU requests"
    echo ""
fi

if kubectl get pods -A --field-selector=status.phase=Pending -o json | grep -q "no nodes available"; then
    echo -e "${YELLOW}⚠️  ISSUE: No nodes available${NC}"
    echo "   Solution: Check if node is Ready: kubectl get nodes"
    echo ""
fi

if kubectl get pvc -A | grep -q "Pending"; then
    echo -e "${YELLOW}⚠️  ISSUE: PVC Pending${NC}"
    echo "   Solution: Check storage class and provisioner"
    echo "   Run: microk8s enable storage"
    echo ""
fi

echo -e "${BLUE}━━━ 9. Quick Fixes ━━━${NC}"
echo ""
echo "Try these commands:"
echo ""
echo "# 1. Restart MicroK8s"
echo "   sudo microk8s stop && sudo microk8s start"
echo ""
echo "# 2. Enable required addons"
echo "   microk8s enable storage dns"
echo ""
echo "# 3. Check logs of pending pod"
echo "   kubectl logs <pod-name> -n <namespace>"
echo ""
echo "# 4. Force delete stuck pods"
echo "   kubectl delete pod <pod-name> -n <namespace> --force --grace-period=0"
echo ""
echo "# 5. Check if using correct context"
echo "   kubectl config current-context"
echo "   # Should show: microk8s"
echo ""