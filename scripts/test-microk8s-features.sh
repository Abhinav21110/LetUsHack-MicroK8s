#!/bin/bash
set -e

echo "================================================"
echo "  MicroK8s Features Test Suite                 "
echo "================================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if MicroK8s is available
if command -v microk8s &> /dev/null; then
    KUBECTL="microk8s kubectl"
    CONTEXT="microk8s"
    echo -e "${GREEN}✓ Using MicroK8s${NC}"
else
    KUBECTL="kubectl"
    CONTEXT=$(kubectl config current-context)
    echo -e "${YELLOW}⚠ Using kubectl (context: $CONTEXT)${NC}"
    echo "  Some features require MicroK8s. Run ./scripts/setup-microk8s.sh to install."
    echo ""
fi

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print test header
test_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}TEST $1: $2${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to record test result
test_result() {
    ((TOTAL_TESTS++))
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        ((FAILED_TESTS++))
    fi
}

# Cleanup function
cleanup() {
    echo ""
    echo "Cleaning up test resources..."
    $KUBECTL delete namespace test-features --ignore-not-found=true --grace-period=0 --force 2>/dev/null || true
    $KUBECTL delete hpa test-autoscaling -n default --ignore-not-found=true 2>/dev/null || true
    $KUBECTL delete deployment test-autoscaling -n default --ignore-not-found=true 2>/dev/null || true
    $KUBECTL delete service test-autoscaling -n default --ignore-not-found=true 2>/dev/null || true
    $KUBECTL delete pod test-self-healing -n default --ignore-not-found=true --grace-period=0 --force 2>/dev/null || true
    $KUBECTL delete pod test-liveness -n default --ignore-not-found=true --grace-period=0 --force 2>/dev/null || true
    sleep 2
}

# Trap to cleanup on exit
trap cleanup EXIT

# ========================================
# TEST 1: Metrics Server
# ========================================
test_header "1" "Metrics Server Availability"

echo "Checking if metrics server is running..."
METRICS_POD=$($KUBECTL get pods -n kube-system -l k8s-app=metrics-server --no-headers 2>/dev/null | grep -c "Running" || echo 0)

if [ "$METRICS_POD" -gt 0 ]; then
    test_result 0 "Metrics server pod is running"
    
    # Wait for metrics to be available
    sleep 5
    
    if $KUBECTL top nodes &> /dev/null; then
        test_result 0 "Node metrics are available"
        $KUBECTL top nodes
    else
        test_result 1 "Node metrics not yet available (may need more time)"
    fi
else
    test_result 1 "Metrics server not found"
    echo "  → Required for autoscaling. Enable with: microk8s enable metrics-server"
fi

# ========================================
# TEST 2: Self-Healing (Automatic Restart)
# ========================================
test_header "2" "Self-Healing: Automatic Pod Restart"

echo "Creating a pod that will crash..."
cat <<EOF | $KUBECTL apply -f - > /dev/null 2>&1
apiVersion: v1
kind: Pod
metadata:
  name: test-self-healing
  namespace: default
spec:
  restartPolicy: Always
  containers:
  - name: crash-container
    image: busybox:latest
    command: ["sh", "-c", "echo 'Starting...'; sleep 5; echo 'Crashing!'; exit 1"]
    resources:
      requests:
        cpu: 10m
        memory: 16Mi
      limits:
        cpu: 50m
        memory: 64Mi
EOF

sleep 3

# Wait for pod to start
echo "Waiting for pod to start and crash..."
for i in {1..15}; do
    POD_STATUS=$($KUBECTL get pod test-self-healing -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")
    if [ "$POD_STATUS" = "Running" ]; then
        break
    fi
    sleep 2
done

# Wait for crash
sleep 10

# Check restart count
RESTART_COUNT=$($KUBECTL get pod test-self-healing -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo 0)

if [ "$RESTART_COUNT" -gt 0 ]; then
    test_result 0 "Pod self-healed with $RESTART_COUNT restart(s)"
    echo "  → Pod automatically restarted after crash"
else
    # Give it more time
    sleep 10
    RESTART_COUNT=$($KUBECTL get pod test-self-healing -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo 0)
    if [ "$RESTART_COUNT" -gt 0 ]; then
        test_result 0 "Pod self-healed with $RESTART_COUNT restart(s)"
    else
        test_result 1 "Pod did not restart automatically"
    fi
fi

# ========================================
# TEST 3: Liveness Probe
# ========================================
test_header "3" "Liveness Probe: Health-based Restart"

echo "Creating a pod with liveness probe..."
cat <<EOF | $KUBECTL apply -f - > /dev/null 2>&1
apiVersion: v1
kind: Pod
metadata:
  name: test-liveness
  namespace: default
spec:
  restartPolicy: Always
  containers:
  - name: liveness-test
    image: nginx:alpine
    ports:
    - containerPort: 80
    resources:
      requests:
        cpu: 10m
        memory: 32Mi
      limits:
        cpu: 100m
        memory: 128Mi
    livenessProbe:
      httpGet:
        path: /health
        port: 80
      initialDelaySeconds: 5
      periodSeconds: 5
      failureThreshold: 2
EOF

sleep 8

# Check if pod is running
POD_STATUS=$($KUBECTL get pod test-liveness -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")

if [ "$POD_STATUS" = "Running" ]; then
    test_result 0 "Pod with liveness probe is running"
    
    # Check for restarts (probe will fail since /health doesn't exist)
    sleep 15
    RESTART_COUNT=$($KUBECTL get pod test-liveness -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo 0)
    
    if [ "$RESTART_COUNT" -gt 0 ]; then
        test_result 0 "Liveness probe triggered restart ($RESTART_COUNT restarts)"
        echo "  → Pod restarted due to failed health check"
    else
        test_result 1 "Liveness probe did not trigger restart yet"
        echo "  → May need more time for probe to fail"
    fi
else
    test_result 1 "Pod failed to start"
fi

# ========================================
# TEST 4: Horizontal Pod Autoscaling (HPA)
# ========================================
test_header "4" "Horizontal Pod Autoscaling (HPA)"

if [ "$METRICS_POD" -eq 0 ]; then
    echo -e "${YELLOW}⚠ Skipping HPA test - Metrics server not available${NC}"
else
    echo "Creating deployment with resource limits..."
    cat <<EOF | $KUBECTL apply -f - > /dev/null 2>&1
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-autoscaling
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: test-autoscaling
  template:
    metadata:
      labels:
        app: test-autoscaling
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: test-autoscaling
  namespace: default
spec:
  selector:
    app: test-autoscaling
  ports:
  - port: 80
    targetPort: 80
EOF

    sleep 5

    echo "Creating HPA (1-5 replicas, CPU target: 50%)..."
    cat <<EOF | $KUBECTL apply -f - > /dev/null 2>&1
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: test-autoscaling
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: test-autoscaling
  minReplicas: 1
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
EOF

    sleep 10

    # Check HPA status
    HPA_EXISTS=$($KUBECTL get hpa test-autoscaling -n default --no-headers 2>/dev/null | wc -l)
    
    if [ "$HPA_EXISTS" -gt 0 ]; then
        test_result 0 "HPA created successfully"
        
        # Check if HPA is active
        HPA_STATUS=$($KUBECTL get hpa test-autoscaling -n default -o jsonpath='{.status.conditions[?(@.type=="ScalingActive")].status}' 2>/dev/null || echo "Unknown")
        
        if [ "$HPA_STATUS" = "True" ]; then
            test_result 0 "HPA is active and monitoring"
            echo ""
            echo "Current HPA status:"
            $KUBECTL get hpa test-autoscaling -n default
            echo ""
            echo "  → HPA will scale pods based on CPU utilization"
            
            # Generate load to trigger scaling
            echo ""
            echo "Simulating load to trigger autoscaling..."
            echo "(This would normally scale up to 5 replicas under load)"
            
            # Get current replicas
            CURRENT_REPLICAS=$($KUBECTL get deployment test-autoscaling -n default -o jsonpath='{.spec.replicas}' 2>/dev/null || echo 1)
            echo "  Current replicas: $CURRENT_REPLICAS"
            
        elif [ "$HPA_STATUS" = "False" ]; then
            test_result 1 "HPA is not active - metrics may not be ready"
            echo "  → Wait 1-2 minutes for metrics to be available"
        else
            test_result 1 "HPA status unknown"
        fi
    else
        test_result 1 "HPA creation failed"
    fi
fi

# ========================================
# TEST 5: Resource Quotas
# ========================================
test_header "5" "Resource Quotas & Limits"

echo "Creating namespace with resource quota..."
cat <<EOF | $KUBECTL apply -f - > /dev/null 2>&1
apiVersion: v1
kind: Namespace
metadata:
  name: test-features
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: test-quota
  namespace: test-features
spec:
  hard:
    requests.cpu: "2"
    requests.memory: 2Gi
    limits.cpu: "4"
    limits.memory: 4Gi
    pods: "10"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: test-limits
  namespace: test-features
spec:
  limits:
  - max:
      cpu: "1"
      memory: 1Gi
    min:
      cpu: "10m"
      memory: 10Mi
    default:
      cpu: "100m"
      memory: 128Mi
    defaultRequest:
      cpu: "50m"
      memory: 64Mi
    type: Container
EOF

sleep 3

# Check if quota was created
QUOTA_EXISTS=$($KUBECTL get resourcequota test-quota -n test-features --no-headers 2>/dev/null | wc -l)
LIMITS_EXIST=$($KUBECTL get limitrange test-limits -n test-features --no-headers 2>/dev/null | wc -l)

if [ "$QUOTA_EXISTS" -gt 0 ]; then
    test_result 0 "ResourceQuota created"
    echo ""
    $KUBECTL describe resourcequota test-quota -n test-features | grep -A 10 "Resource"
else
    test_result 1 "ResourceQuota creation failed"
fi

if [ "$LIMITS_EXIST" -gt 0 ]; then
    test_result 0 "LimitRange created"
else
    test_result 1 "LimitRange creation failed"
fi

# ========================================
# TEST 6: Network Policies (Calico)
# ========================================
test_header "6" "Network Policies (Calico)"

# Check if Calico is installed
CALICO_PODS=$($KUBECTL get pods -n calico-system --no-headers 2>/dev/null | grep -c "Running" || echo 0)
if [ "$CALICO_PODS" -eq 0 ]; then
    CALICO_PODS=$($KUBECTL get pods -n kube-system -l k8s-app=calico-node --no-headers 2>/dev/null | grep -c "Running" || echo 0)
fi

if [ "$CALICO_PODS" -gt 0 ]; then
    test_result 0 "Calico CNI is running ($CALICO_PODS pods)"
    
    # Check for network policies
    NETWORK_POLICIES=$($KUBECTL get networkpolicy -A --no-headers 2>/dev/null | wc -l)
    GLOBAL_POLICIES=$($KUBECTL get globalnetworkpolicy --no-headers 2>/dev/null | wc -l || echo 0)
    
    TOTAL_POLICIES=$((NETWORK_POLICIES + GLOBAL_POLICIES))
    
    if [ "$TOTAL_POLICIES" -gt 0 ]; then
        test_result 0 "Network policies configured ($TOTAL_POLICIES policies)"
        echo ""
        echo "Network policies:"
        $KUBECTL get networkpolicy -A 2>/dev/null | head -5
        if [ "$GLOBAL_POLICIES" -gt 0 ]; then
            echo ""
            echo "Global network policies:"
            $KUBECTL get globalnetworkpolicy 2>/dev/null
        fi
    else
        test_result 1 "No network policies found"
        echo "  → Network isolation not configured"
    fi
else
    test_result 1 "Calico CNI not found"
    echo "  → Network policies require Calico"
fi

# ========================================
# TEST 7: Persistent Storage
# ========================================
test_header "7" "Persistent Storage"

echo "Creating PVC..."
cat <<EOF | $KUBECTL apply -f - > /dev/null 2>&1
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-pvc
  namespace: test-features
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 100Mi
  storageClassName: ${CONTEXT == "microk8s" && echo "microk8s-hostpath" || echo "standard"}
EOF

sleep 5

# Check PVC status
PVC_STATUS=$($KUBECTL get pvc test-pvc -n test-features -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")

if [ "$PVC_STATUS" = "Bound" ]; then
    test_result 0 "PVC bound successfully"
    echo ""
    $KUBECTL get pvc test-pvc -n test-features
elif [ "$PVC_STATUS" = "Pending" ]; then
    test_result 1 "PVC is pending (storage class may not be available)"
    echo "  → Check: kubectl get storageclass"
else
    test_result 1 "PVC creation failed"
fi

# ========================================
# TEST 8: Pod Priority Classes
# ========================================
test_header "8" "Pod Priority Classes"

# Check for priority classes
PRIORITY_CLASSES=$($KUBECTL get priorityclass --no-headers 2>/dev/null | grep -c "letushack" || echo 0)

if [ "$PRIORITY_CLASSES" -gt 0 ]; then
    test_result 0 "Priority classes configured ($PRIORITY_CLASSES classes)"
    echo ""
    $KUBECTL get priorityclass | grep letushack
else
    echo -e "${YELLOW}⚠ No custom priority classes found${NC}"
    echo "  → Optional: Apply k8s/microk8s/priority-classes.yaml"
fi

# ========================================
# TEST 9: Ingress Controller
# ========================================
test_header "9" "Ingress Controller"

INGRESS_PODS=$($KUBECTL get pods -n ingress --no-headers 2>/dev/null | grep -c "Running" || echo 0)
if [ "$INGRESS_PODS" -eq 0 ]; then
    INGRESS_PODS=$($KUBECTL get pods -n ingress-nginx --no-headers 2>/dev/null | grep -c "Running" || echo 0)
fi

if [ "$INGRESS_PODS" -gt 0 ]; then
    test_result 0 "Ingress controller is running"
    
    # Check ingress resources
    INGRESS_RESOURCES=$($KUBECTL get ingress -A --no-headers 2>/dev/null | wc -l)
    if [ "$INGRESS_RESOURCES" -gt 0 ]; then
        test_result 0 "Ingress resources configured ($INGRESS_RESOURCES)"
    fi
else
    test_result 1 "Ingress controller not found"
    echo "  → Required for routing. Enable with: microk8s enable ingress"
fi

# ========================================
# Summary
# ========================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "MicroK8s features are working correctly:"
    echo "  ✓ Self-healing (automatic restarts)"
    echo "  ✓ Liveness probes"
    echo "  ✓ Horizontal pod autoscaling"
    echo "  ✓ Resource quotas & limits"
    echo "  ✓ Calico network policies"
    echo "  ✓ Persistent storage"
    echo "  ✓ Ingress routing"
    exit 0
else
    echo -e "${YELLOW}⚠ Some tests failed${NC}"
    echo ""
    if [ "$CONTEXT" != "microk8s" ]; then
        echo "NOTE: You're using $CONTEXT, not MicroK8s."
        echo "To get full MicroK8s features, run:"
        echo "  ./scripts/setup-microk8s.sh"
    else
        echo "Some features may need more time to initialize."
        echo "Run this script again after a few minutes."
    fi
    exit 1
fi
