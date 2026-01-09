#!/bin/bash
set -e

echo "========================================"
echo "  MicroK8s Validation & Testing        "
echo "========================================"
echo ""
echo "This script validates the MicroK8s setup and tests"
echo "all new capabilities: autoscaling, self-healing, etc."
echo ""

KUBECTL="microk8s kubectl"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test result
test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

echo "Test 1: Cluster Connectivity"
echo "------------------------------------"
if $KUBECTL cluster-info &> /dev/null; then
    test_result 0 "Cluster is reachable"
else
    test_result 1 "Cluster is not reachable"
    exit 1
fi

echo ""
echo "Test 2: Node Status"
echo "------------------------------------"
NODE_COUNT=$($KUBECTL get nodes --no-headers | wc -l)
READY_NODES=$($KUBECTL get nodes --no-headers | grep -c "Ready" || echo 0)

if [ "$NODE_COUNT" -gt 0 ] && [ "$READY_NODES" -eq "$NODE_COUNT" ]; then
    test_result 0 "All $NODE_COUNT nodes are Ready"
else
    test_result 1 "Some nodes are not Ready ($READY_NODES/$NODE_COUNT)"
fi

echo ""
echo "Test 3: Calico Installation"
echo "------------------------------------"
CALICO_PODS=$($KUBECTL get pods -n calico-system --no-headers 2>/dev/null | grep -c "Running" || echo 0)

if [ "$CALICO_PODS" -gt 0 ]; then
    test_result 0 "Calico is running ($CALICO_PODS pods)"
else
    # Try kube-system (older Calico versions)
    CALICO_PODS=$($KUBECTL get pods -n kube-system -l k8s-app=calico-node --no-headers 2>/dev/null | grep -c "Running" || echo 0)
    if [ "$CALICO_PODS" -gt 0 ]; then
        test_result 0 "Calico is running in kube-system ($CALICO_PODS pods)"
    else
        test_result 1 "Calico is not running"
    fi
fi

echo ""
echo "Test 4: Metrics Server"
echo "------------------------------------"
METRICS_POD=$($KUBECTL get pods -n kube-system -l k8s-app=metrics-server --no-headers 2>/dev/null | grep -c "Running" || echo 0)

if [ "$METRICS_POD" -gt 0 ]; then
    test_result 0 "Metrics Server is running"
    
    # Wait for metrics to be available
    sleep 5
    if $KUBECTL top nodes &> /dev/null; then
        test_result 0 "Metrics are available"
    else
        test_result 1 "Metrics not yet available (may need more time)"
    fi
else
    test_result 1 "Metrics Server is not running"
fi

echo ""
echo "Test 5: Ingress Controller"
echo "------------------------------------"
INGRESS_PODS=$($KUBECTL get pods -n ingress --no-headers 2>/dev/null | grep -c "Running" || echo 0)

if [ "$INGRESS_PODS" -gt 0 ]; then
    test_result 0 "Ingress Controller is running"
else
    test_result 1 "Ingress Controller is not running"
fi

echo ""
echo "Test 6: Storage Class"
echo "------------------------------------"
STORAGE_CLASS=$($KUBECTL get storageclass microk8s-hostpath --no-headers 2>/dev/null | wc -l)

if [ "$STORAGE_CLASS" -gt 0 ]; then
    test_result 0 "Storage class 'microk8s-hostpath' exists"
else
    test_result 1 "Storage class not found"
fi

echo ""
echo "Test 7: Platform Namespace"
echo "------------------------------------"
NAMESPACE=$($KUBECTL get namespace letushack --no-headers 2>/dev/null | wc -l)

if [ "$NAMESPACE" -gt 0 ]; then
    test_result 0 "Namespace 'letushack' exists"
    
    # Check labels
    LABEL=$($KUBECTL get namespace letushack -o jsonpath='{.metadata.labels.app\.letushack\.com/tenant}' 2>/dev/null)
    if [ "$LABEL" = "platform" ]; then
        test_result 0 "Namespace has correct label"
    else
        test_result 1 "Namespace label is incorrect"
    fi
else
    test_result 1 "Namespace 'letushack' not found"
fi

echo ""
echo "Test 8: Resource Quotas"
echo "------------------------------------"
QUOTA=$($KUBECTL get resourcequota -n letushack --no-headers 2>/dev/null | wc -l)

if [ "$QUOTA" -gt 0 ]; then
    test_result 0 "ResourceQuota configured"
else
    test_result 1 "ResourceQuota not found"
fi

echo ""
echo "Test 9: Limit Ranges"
echo "------------------------------------"
LIMITS=$($KUBECTL get limitrange -n letushack --no-headers 2>/dev/null | wc -l)

if [ "$LIMITS" -gt 0 ]; then
    test_result 0 "LimitRange configured"
else
    test_result 1 "LimitRange not found"
fi

echo ""
echo "Test 10: Network Policies"
echo "------------------------------------"
POLICIES=$($KUBECTL get networkpolicy -A --no-headers 2>/dev/null | wc -l)
GLOBAL_POLICIES=$($KUBECTL get globalnetworkpolicy --no-headers 2>/dev/null | wc -l || echo 0)

TOTAL_POLICIES=$((POLICIES + GLOBAL_POLICIES))

if [ "$TOTAL_POLICIES" -gt 0 ]; then
    test_result 0 "Network policies configured ($TOTAL_POLICIES policies)"
else
    test_result 1 "No network policies found"
fi

echo ""
echo "Test 11: PersistentVolume"
echo "------------------------------------"
PV=$($KUBECTL get pv --no-headers 2>/dev/null | wc -l)

if [ "$PV" -gt 0 ]; then
    test_result 0 "PersistentVolume(s) configured ($PV PVs)"
else
    echo -e "${YELLOW}⚠ WARN${NC}: No PersistentVolumes found (will be created on demand)"
fi

echo ""
echo "Test 12: Priority Classes"
echo "------------------------------------"
PRIORITY=$($KUBECTL get priorityclass --no-headers 2>/dev/null | grep -c "letushack" || echo 0)

if [ "$PRIORITY" -gt 0 ]; then
    test_result 0 "Priority classes configured"
else
    echo -e "${YELLOW}⚠ WARN${NC}: Priority classes not found (optional)"
fi

echo ""
echo "Test 13: Self-Healing (Pod Restart)"
echo "------------------------------------"
echo "Creating test pod to verify self-healing..."

# Create a test pod
cat <<EOF | $KUBECTL apply -f - > /dev/null 2>&1
apiVersion: v1
kind: Pod
metadata:
  name: test-self-healing
  namespace: letushack
spec:
  restartPolicy: Always
  containers:
  - name: test
    image: busybox:latest
    command: ["sh", "-c", "sleep 300"]
    resources:
      requests:
        cpu: 10m
        memory: 16Mi
      limits:
        cpu: 50m
        memory: 64Mi
EOF

# Wait for pod to be running
sleep 10
POD_STATUS=$($KUBECTL get pod test-self-healing -n letushack -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")

if [ "$POD_STATUS" = "Running" ]; then
    test_result 0 "Test pod created successfully"
    
    # Kill the process in the pod to trigger restart
    echo "   Triggering pod restart..."
    $KUBECTL exec test-self-healing -n letushack -- sh -c "kill 1" &> /dev/null || true
    
    sleep 10
    
    # Check if pod restarted
    RESTART_COUNT=$($KUBECTL get pod test-self-healing -n letushack -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo 0)
    
    if [ "$RESTART_COUNT" -gt 0 ]; then
        test_result 0 "Pod self-healed (restart count: $RESTART_COUNT)"
    else
        test_result 1 "Pod did not restart automatically"
    fi
    
    # Cleanup
    $KUBECTL delete pod test-self-healing -n letushack --force --grace-period=0 &> /dev/null || true
else
    test_result 1 "Test pod failed to start"
fi

echo ""
echo "Test 14: Autoscaling Capability"
echo "------------------------------------"

# Check if HPA CRD exists
HPA_CRD=$($KUBECTL api-resources | grep -c "horizontalpodautoscalers" || echo 0)

if [ "$HPA_CRD" -gt 0 ]; then
    test_result 0 "HPA API available"
    
    # Create a test deployment with HPA
    echo "   Creating test deployment for HPA..."
    
    cat <<EOF | $KUBECTL apply -f - > /dev/null 2>&1
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-hpa
  namespace: letushack
spec:
  replicas: 1
  selector:
    matchLabels:
      app: test-hpa
  template:
    metadata:
      labels:
        app: test-hpa
    spec:
      containers:
      - name: test
        image: nginx:alpine
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 100m
            memory: 128Mi
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: test-hpa
  namespace: letushack
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: test-hpa
  minReplicas: 1
  maxReplicas: 3
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
EOF

    sleep 15
    
    # Check if HPA was created
    HPA_EXISTS=$($KUBECTL get hpa test-hpa -n letushack --no-headers 2>/dev/null | wc -l)
    
    if [ "$HPA_EXISTS" -gt 0 ]; then
        test_result 0 "HPA created successfully"
        
        # Check HPA status
        HPA_STATUS=$($KUBECTL get hpa test-hpa -n letushack -o jsonpath='{.status.conditions[?(@.type=="ScalingActive")].status}' 2>/dev/null || echo "Unknown")
        
        if [ "$HPA_STATUS" = "True" ]; then
            test_result 0 "HPA is active and monitoring metrics"
        else
            echo -e "${YELLOW}⚠ WARN${NC}: HPA created but not yet active (metrics may need time)"
        fi
    else
        test_result 1 "HPA creation failed"
    fi
    
    # Cleanup
    $KUBECTL delete hpa test-hpa -n letushack &> /dev/null || true
    $KUBECTL delete deployment test-hpa -n letushack &> /dev/null || true
else
    test_result 1 "HPA API not available"
fi

echo ""
echo "Test 15: Persistent Storage"
echo "------------------------------------"

# Create test PVC
cat <<EOF | $KUBECTL apply -f - > /dev/null 2>&1
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-pvc
  namespace: letushack
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 100Mi
  storageClassName: microk8s-hostpath
EOF

sleep 10

PVC_STATUS=$($KUBECTL get pvc test-pvc -n letushack -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")

if [ "$PVC_STATUS" = "Bound" ]; then
    test_result 0 "PVC bound successfully"
else
    test_result 1 "PVC not bound (status: $PVC_STATUS)"
fi

# Cleanup
$KUBECTL delete pvc test-pvc -n letushack &> /dev/null || true

echo ""
echo "========================================"
echo "  Test Summary                         "
echo "========================================"
echo ""
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical tests passed!${NC}"
    echo ""
    echo "MicroK8s is properly configured with:"
    echo "  ✓ Calico networking"
    echo "  ✓ Metrics server (autoscaling ready)"
    echo "  ✓ Ingress controller"
    echo "  ✓ Persistent storage"
    echo "  ✓ Self-healing pods"
    echo "  ✓ Horizontal pod autoscaling"
    echo "  ✓ Resource management"
    echo "  ✓ Network policies"
    echo ""
    echo "Your cluster is ready for production use!"
    exit 0
else
    echo -e "${YELLOW}⚠ Some tests failed. Review the output above.${NC}"
    echo ""
    echo "Common issues:"
    echo "  - Metrics may take 1-2 minutes to be available"
    echo "  - Some components may still be starting"
    echo "  - Run this script again after a few minutes"
    exit 1
fi
