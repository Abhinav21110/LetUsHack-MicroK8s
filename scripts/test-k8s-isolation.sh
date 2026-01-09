#!/bin/bash

echo "========================================="  
echo "  Testing Calico Network Isolation     "
echo "=========================================

"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "${RED}❌ kubectl not found${NC}"
    exit 1
fi

# Test 1: Check if namespaces exist
echo "Test 1: Creating test user namespaces..."
kubectl create namespace letushack-testuser1 --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace letushack-testuser2 --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace letushack-testuser1 app.letushack.com/user-id=testuser1 app.letushack.com/tenant=user --overwrite
kubectl label namespace letushack-testuser2 app.letushack.com/user-id=testuser2 app.letushack.com/tenant=user --overwrite
echo "${GREEN}✅ Test namespaces created${NC}"

# Test 2: Deploy test pods
echo ""
echo "Test 2: Deploying test pods..."
kubectl run test-pod-user1 --image=nginx --namespace=letushack-testuser1 --labels="app.letushack.com/tenant=user"
kubectl run test-pod-user2 --image=nginx --namespace=letushack-testuser2 --labels="app.letushack.com/tenant=user"
kubectl wait --for=condition=ready pod/test-pod-user1 -n letushack-testuser1 --timeout=60s
kubectl wait --for=condition=ready pod/test-pod-user2 -n letushack-testuser2 --timeout=60s
echo "${GREEN}✅ Test pods deployed${NC}"

# Test 3: Apply NetworkPolicies
echo ""
echo "Test 3: Applying default-deny NetworkPolicies..."
kubectl apply -f k8s/policies/default-deny-all.yaml -n letushack-testuser1
kubectl apply -f k8s/policies/default-deny-all.yaml -n letushack-testuser2
echo "${GREEN}✅ NetworkPolicies applied${NC}"

# Test 4: Test cross-user isolation (should FAIL)
echo ""
echo "Test 4: Testing cross-user communication (should be BLOCKED)..."
USER2_IP=$(kubectl get pod test-pod-user2 -n letushack-testuser2 -o jsonpath='{.status.podIP}')
if kubectl exec test-pod-user1 -n letushack-testuser1 -- timeout 5 curl -s http://$USER2_IP > /dev/null 2>&1; then
    echo "${RED}❌ FAILED: Cross-user communication was allowed (should be blocked)${NC}"
else
    echo "${GREEN}✅ PASSED: Cross-user communication blocked as expected${NC}"
fi

# Test 5: Verify ingress access (requires ingress controller)
echo ""
echo "Test 5: Verifying ingress controller accessibility..."
if kubectl get svc ingress-nginx-controller -n ingress-nginx > /dev/null 2>&1; then
    echo "${GREEN}✅ Ingress controller is accessible${NC}"
else
    echo "${RED}⚠️  Ingress controller not found${NC}"
fi

# Cleanup
echo ""
read -p "Do you want to cleanup test resources? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleaning up..."
    kubectl delete namespace letushack-testuser1
    kubectl delete namespace letushack-testuser2
    echo "${GREEN}✅ Cleanup complete${NC}"
fi

echo ""
echo "========================================="
echo "  Isolation Testing Complete           "
echo "========================================="
