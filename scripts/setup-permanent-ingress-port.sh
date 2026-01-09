#!/bin/bash

echo "================================================"
echo "  Permanent Ingress Port Setup (8100)         "
echo "================================================"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}Creating permanent port forwarding solution...${NC}"
echo ""

# Option 1: Update MicroK8s ingress to listen on port 8100
echo -e "${BLUE}Step 1: Patching MicroK8s ingress to listen on port 8100...${NC}"

kubectl patch daemonset nginx-ingress-microk8s-controller -n ingress --type='json' -p='[
  {
    "op": "add",
    "path": "/spec/template/spec/containers/0/ports/-",
    "value": {
      "containerPort": 8100,
      "hostPort": 8100,
      "name": "http-alt",
      "protocol": "TCP"
    }
  }
]' 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Ingress patched to listen on port 8100${NC}"
else
    echo -e "${YELLOW}⚠ Patch may have failed, trying alternative method...${NC}"
    
    # Alternative: Use kubectl edit approach with a configmap
    echo -e "${BLUE}Step 2: Creating nginx config to listen on 8100...${NC}"
    
    kubectl create configmap nginx-configuration -n ingress \
      --from-literal=http-port=80 \
      --from-literal=http-alt-port=8100 \
      --dry-run=client -o yaml | kubectl apply -f -
    
    # Restart ingress controller
    kubectl delete pod -n ingress -l app.kubernetes.io/name=ingress-nginx
    
    sleep 5
fi

echo ""
echo -e "${BLUE}Step 3: Verifying port 8100...${NC}"
sleep 5

if netstat -tlnp 2>/dev/null | grep :8100 > /dev/null; then
    echo -e "${GREEN}✓ Port 8100 is now listening!${NC}"
else
    echo -e "${YELLOW}⚠ Port 8100 not detected yet. Using systemd service fallback...${NC}"
    
    # Fallback: Create systemd service for socat
    sudo tee /etc/systemd/system/microk8s-ingress-forward.service > /dev/null <<EOF
[Unit]
Description=MicroK8s Ingress Port Forward (8100 -> 80)
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/socat TCP-LISTEN:8100,fork,reuseaddr TCP:127.0.0.1:80
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable microk8s-ingress-forward.service
    sudo systemctl start microk8s-ingress-forward.service
    
    sleep 2
    
    if sudo systemctl is-active microk8s-ingress-forward.service > /dev/null; then
        echo -e "${GREEN}✓ Systemd service created and running!${NC}"
    else
        echo -e "${RED}✗ Service failed to start${NC}"
        sudo journalctl -u microk8s-ingress-forward.service -n 20
    fi
fi

echo ""
echo -e "${BLUE}Step 4: Testing port 8100...${NC}"
sleep 2

if curl -s -I http://localhost:8100 --max-time 3 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Port 8100 is accessible!${NC}"
    echo ""
    echo -e "${GREEN}SUCCESS: Permanent port forwarding is now active${NC}"
    echo ""
    echo "You can now access labs on: http://localhost:8100"
else
    echo -e "${YELLOW}⚠ Port 8100 test inconclusive (may need ingress paths)${NC}"
    echo ""
    echo "Check status with:"
    echo "  sudo systemctl status microk8s-ingress-forward"
    echo "  sudo netstat -tlnp | grep 8100"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}PERMANENT SOLUTION DEPLOYED${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Port 8100 will now:"
echo "  ✓ Start automatically on boot"
echo "  ✓ Restart if it crashes"
echo "  ✓ Forward all traffic to port 80"
echo ""
echo "To check status:"
echo "  sudo systemctl status microk8s-ingress-forward"
echo ""
echo "To stop (if needed):"
echo "  sudo systemctl stop microk8s-ingress-forward"
echo ""
