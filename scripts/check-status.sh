#!/bin/bash
# Quick status check for K8s labs

echo "======================================"
echo "  LetUsHack K8s Status Check"
echo "======================================"
echo ""

# Check port-forward
echo "1. Port-forward status (port 8100):"
if ps aux | grep -v grep | grep -q "port-forward.*8100:80"; then
    echo "   ✓ Port-forward is running"
    PID=$(ps aux | grep -v grep | grep "port-forward.*8100:80" | awk '{print $2}')
    echo "   PID: $PID"
else
    echo "   ✗ Port-forward is NOT running"
    echo "   Run: ./scripts/start-port-forward.sh"
fi

echo ""
echo "2. Port 8100 connectivity:"
if timeout 2 curl -s -o /dev/null http://localhost:8100 2>/dev/null; then
    echo "   ✓ Port 8100 is accessible"
else
    echo "   ✗ Cannot reach port 8100"
fi

echo ""
echo "3. Active lab pods:"
PODS=$(kubectl get pods --all-namespaces | grep -v "kube-system\|ingress-nginx\|local-path\|NAMESPACE" | wc -l)
if [ "$PODS" -gt 0 ]; then
    echo "   Found $PODS active lab pod(s):"
    kubectl get pods --all-namespaces | grep -v "kube-system\|ingress-nginx\|local-path\|NAMESPACE"
else
    echo "   No active lab pods"
fi

echo ""
echo "4. Active ingress routes:"
INGRESS=$(kubectl get ingress --all-namespaces 2>/dev/null | wc -l)
if [ "$INGRESS" -gt 1 ]; then
    echo "   Found ingress route(s):"
    kubectl get ingress --all-namespaces
else
    echo "   No active ingress routes"
fi

echo ""
echo "======================================"
