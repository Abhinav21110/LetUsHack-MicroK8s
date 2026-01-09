#!/bin/bash

echo "================================================"
echo "  Kubernetes Features Test (Current Cluster)   "
echo "================================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

KUBECTL="kubectl"
CONTEXT=$(kubectl config current-context)
echo "Current context: $CONTEXT"
echo ""

# Test counter
PASSED=0
FAILED=0

test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        ((FAILED++))
    fi
}

echo -e "${BLUE}━━━ TEST 1: Self-Healing (Auto Restart) ━━━${NC}"
echo "Creating pod that will crash..."

cat <<'EOF' | kubectl apply -f - >/dev/null 2>&1
apiVersion: v1
kind: Pod
metadata:
  name: test-self-healing
spec:
  restartPolicy: Always
  containers:
  - name: crash-container
    image: busybox:latest
    command: ["sh", "-c", "echo 'Starting'; sleep 5; echo 'Crashing'; exit 1"]
    resources:
      requests:
        cpu: 10m
        memory: 16Mi
      limits:
        cpu: 50m
        memory: 64Mi
EOF

sleep 8
RESTART_COUNT=$(kubectl get pod test-self-healing -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo 0)

if [ "$RESTART_COUNT" -gt 0 ]; then
    test_result 0 "Pod auto-restarted ($RESTART_COUNT restarts)"
else
    sleep 10
    RESTART_COUNT=$(kubectl get pod test-self-healing -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo 0)
    if [ "$RESTART_COUNT" -gt 0 ]; then
        test_result 0 "Pod auto-restarted ($RESTART_COUNT restarts)"
    else
        test_result 1 "Pod did not auto-restart"
    fi
fi

echo ""
echo -e "${BLUE}━━━ TEST 2: Liveness Probes ━━━${NC}"
echo "Creating pod with liveness probe..."

cat <<'EOF' | kubectl apply -f - >/dev/null 2>&1
apiVersion: v1
kind: Pod
metadata:
  name: test-liveness
spec:
  restartPolicy: Always
  containers:
  - name: nginx
    image: nginx:alpine
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
      initialDelaySeconds: 3
      periodSeconds: 3
      failureThreshold: 2
EOF

sleep 12
RESTART_COUNT=$(kubectl get pod test-liveness -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo 0)

if [ "$RESTART_COUNT" -gt 0 ]; then
    test_result 0 "Liveness probe triggered restart ($RESTART_COUNT restarts)"
else
    test_result 1 "Liveness probe did not trigger restart yet (may need more time)"
fi

echo ""
echo -e "${BLUE}━━━ TEST 3: Metrics Server ━━━${NC}"
METRICS_POD=$(kubectl get pods -n kube-system -l k8s-app=metrics-server --no-headers 2>/dev/null | grep -c "Running" || echo 0)

if [ "$METRICS_POD" -gt 0 ]; then
    test_result 0 "Metrics server is running"
    sleep 3
    if kubectl top nodes >/dev/null 2>&1; then
        test_result 0 "Metrics are available"
        kubectl top nodes
    else
        test_result 1 "Metrics not available yet"
    fi
else
    test_result 1 "Metrics server not found (required for autoscaling)"
fi

echo ""
echo -e "${BLUE}━━━ TEST 4: Horizontal Pod Autoscaler ━━━${NC}"

if [ "$METRICS_POD" -gt 0 ]; then
    echo "Creating deployment with HPA..."
    
    cat <<'EOF' | kubectl apply -f - >/dev/null 2>&1
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-hpa
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
      - name: nginx
        image: nginx:alpine
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 256Mi
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: test-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: test-hpa
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
    HPA_EXISTS=$(kubectl get hpa test-hpa --no-headers 2>/dev/null | wc -l)
    
    if [ "$HPA_EXISTS" -gt 0 ]; then
        test_result 0 "HPA created successfully"
        HPA_STATUS=$(kubectl get hpa test-hpa -o jsonpath='{.status.conditions[?(@.type=="ScalingActive")].status}' 2>/dev/null || echo "Unknown")
        if [ "$HPA_STATUS" = "True" ]; then
            test_result 0 "HPA is active"
            kubectl get hpa test-hpa
        else
            test_result 1 "HPA not active yet (metrics may need time)"
        fi
    else
        test_result 1 "HPA creation failed"
    fi
else
    echo "Skipping (metrics server required)"
fi

echo ""
echo -e "${BLUE}━━━ TEST 5: Calico Network Policies ━━━${NC}"
CALICO_PODS=$(kubectl get pods -n kube-system -l k8s-app=calico-node --no-headers 2>/dev/null | grep -c "Running" || echo 0)

if [ "$CALICO_PODS" -gt 0 ]; then
    test_result 0 "Calico is running ($CALICO_PODS pods)"
    
    NET_POLICIES=$(kubectl get networkpolicy -A --no-headers 2>/dev/null | wc -l)
    if [ "$NET_POLICIES" -gt 0 ]; then
        test_result 0 "Network policies configured ($NET_POLICIES policies)"
        kubectl get networkpolicy -A
    else
        test_result 1 "No network policies found"
    fi
else
    test_result 1 "Calico not found"
fi

echo ""
echo -e "${BLUE}━━━ TEST 6: Ingress Controller ━━━${NC}"
INGRESS_PODS=$(kubectl get pods -n ingress-nginx --no-headers 2>/dev/null | grep -c "Running" || echo 0)

if [ "$INGRESS_PODS" -gt 0 ]; then
    test_result 0 "Ingress controller running ($INGRESS_PODS pods)"
    
    INGRESS_COUNT=$(kubectl get ingress -A --no-headers 2>/dev/null | wc -l)
    if [ "$INGRESS_COUNT" -gt 0 ]; then
        test_result 0 "Ingress resources configured ($INGRESS_COUNT)"
    fi
else
    test_result 1 "Ingress controller not found"
fi

echo ""
echo -e "${BLUE}━━━ TEST 7: Persistent Storage ━━━${NC}"
cat <<'EOF' | kubectl apply -f - >/dev/null 2>&1
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-pvc
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 100Mi
EOF

sleep 5
PVC_STATUS=$(kubectl get pvc test-pvc -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")

if [ "$PVC_STATUS" = "Bound" ]; then
    test_result 0 "PVC bound successfully"
    kubectl get pvc test-pvc
elif [ "$PVC_STATUS" = "Pending" ]; then
    test_result 1 "PVC pending (storage class may not be available)"
else
    test_result 1 "PVC creation failed"
fi

echo ""
echo -e "${BLUE}━━━ TEST 8: Resource Quotas ━━━${NC}"
kubectl create namespace test-ns >/dev/null 2>&1 || true

cat <<'EOF' | kubectl apply -f - >/dev/null 2>&1
apiVersion: v1
kind: ResourceQuota
metadata:
  name: test-quota
  namespace: test-ns
spec:
  hard:
    requests.cpu: "2"
    requests.memory: 2Gi
    pods: "10"
EOF

sleep 2
QUOTA_EXISTS=$(kubectl get resourcequota test-quota -n test-ns --no-headers 2>/dev/null | wc -l)

if [ "$QUOTA_EXISTS" -gt 0 ]; then
    test_result 0 "ResourceQuota created"
else
    test_result 1 "ResourceQuota creation failed"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Passed: ${GREEN}$PASSED${NC}"
echo "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All features working!${NC}"
else
    echo -e "${YELLOW}⚠ Some features not available on current cluster${NC}"
fi

# Cleanup
echo ""
echo "Cleaning up test resources..."
kubectl delete pod test-self-healing --ignore-not-found=true --grace-period=0 --force 2>/dev/null &
kubectl delete pod test-liveness --ignore-not-found=true --grace-period=0 --force 2>/dev/null &
kubectl delete deployment test-hpa --ignore-not-found=true 2>/dev/null &
kubectl delete service test-hpa --ignore-not-found=true 2>/dev/null &
kubectl delete hpa test-hpa --ignore-not-found=true 2>/dev/null &
kubectl delete pvc test-pvc --ignore-not-found=true 2>/dev/null &
kubectl delete namespace test-ns --ignore-not-found=true 2>/dev/null &
wait 2>/dev/null
echo "Done!"
