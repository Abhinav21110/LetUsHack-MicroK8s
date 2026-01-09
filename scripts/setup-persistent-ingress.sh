#!/bin/bash
# Permanent Ingress Setup
# This script configures iptables inside the Kind container to route port 8100 to the Ingress Pod

set -e

CONTAINER_NAME="letushack-local-control-plane"
NODE_PORT=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.spec.ports[0].nodePort}')
CLUSTER_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.spec.clusterIP}')
POD_IP=$(kubectl get pod -n ingress-nginx -l app.kubernetes.io/component=controller -o jsonpath='{.items[0].status.podIP}')

echo "Setting up permanent ingress routing..."
echo "NodePort: $NODE_PORT"
echo "ClusterIP: $CLUSTER_IP"
echo "PodIP: $POD_IP"
echo "Container: $CONTAINER_NAME"

# Clear any existing socat processes
docker exec $CONTAINER_NAME pkill socat 2>/dev/null || true

# Clean up existing iptables rules (Try to remove ALL variants)
# NodePort cleanup
docker exec $CONTAINER_NAME iptables -t nat -D PREROUTING -p tcp --dport 8100 -j REDIRECT --to-port $NODE_PORT 2>/dev/null || true
docker exec $CONTAINER_NAME iptables -t nat -D OUTPUT -p tcp -d 127.0.0.1 --dport 8100 -j REDIRECT --to-port $NODE_PORT 2>/dev/null || true
docker exec $CONTAINER_NAME iptables -t nat -D OUTPUT -p tcp -d 0.0.0.0/0 --dport 8100 -j DNAT --to-destination 127.0.0.1:$NODE_PORT 2>/dev/null || true

# ClusterIP cleanup
docker exec $CONTAINER_NAME iptables -t nat -D PREROUTING -p tcp --dport 8100 -j DNAT --to-destination $CLUSTER_IP:80 2>/dev/null || true
docker exec $CONTAINER_NAME iptables -t nat -D OUTPUT -p tcp -d 0.0.0.0/0 --dport 8100 -j DNAT --to-destination $CLUSTER_IP:80 2>/dev/null || true
docker exec $CONTAINER_NAME iptables -t nat -D POSTROUTING -p tcp -d $CLUSTER_IP --dport 80 -j MASQUERADE 2>/dev/null || true

# PodIP cleanup (in case run multiple times)
docker exec $CONTAINER_NAME iptables -t nat -D PREROUTING -p tcp --dport 8100 -j DNAT --to-destination $POD_IP:80 2>/dev/null || true
docker exec $CONTAINER_NAME iptables -t nat -D OUTPUT -p tcp -d 0.0.0.0/0 --dport 8100 -j DNAT --to-destination $POD_IP:80 2>/dev/null || true
docker exec $CONTAINER_NAME iptables -t nat -D POSTROUTING -p tcp -d $POD_IP --dport 80 -j MASQUERADE 2>/dev/null || true

# Add iptables rules to redirect port 8100 -> PodIP:80
# Using PodIP bypasses Service/Kube-Proxy issues
# 1. Capture external traffic (PREROUTING)
docker exec $CONTAINER_NAME iptables -t nat -A PREROUTING -p tcp --dport 8100 -j DNAT --to-destination $POD_IP:80
# 2. Capture local traffic (OUTPUT)
docker exec $CONTAINER_NAME iptables -t nat -A OUTPUT -p tcp -d 0.0.0.0/0 --dport 8100 -j DNAT --to-destination $POD_IP:80
# 3. Masquerade traffic to ensure return path
docker exec $CONTAINER_NAME iptables -t nat -A POSTROUTING -p tcp -d $POD_IP --dport 80 -j MASQUERADE

echo ""
echo "✓ Ingress routing configured!"
echo "✓ Port 8100 (host) -> $POD_IP:80 (PodIP) -> NGINX Ingress"
echo ""
echo "Testing connection..."
sleep 2

# Test from host
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8100/healthz; then
    echo "✓ SUCCESS! Ingress is accessible at http://localhost:8100"
    echo ""
    echo "No more manual port-forwarding needed!"
else
    echo "⚠ Could not verify connection."
    echo "Check if Ingress Controller is running:"
    echo "kubectl get pods -n ingress-nginx"
fi
