#!/bin/bash

echo "================================================"
echo "  MicroK8s + Port 8100 Startup Verification   "
echo "================================================"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "Checking persistent services after reboot..."
echo ""

# Check 1: MicroK8s running
echo -n "1. MicroK8s service: "
if microk8s status --wait-ready > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
fi

# Check 2: Port forwarding service
echo -n "2. Port 8100 forwarding: "
if sudo systemctl is-active microk8s-ingress-8100.service > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo "   Fix: sudo systemctl start microk8s-ingress-8100.service"
fi

# Check 3: Ingress controller
echo -n "3. Ingress controller: "
if kubectl get pods -n ingress 2>/dev/null | grep -q "Running"; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
fi

# Check 4: Port 80 accessible
echo -n "4. Port 80 (ingress): "
if curl -s -I http://localhost:80 --max-time 3 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Accessible${NC}"
else
    echo -e "${RED}✗ Not accessible${NC}"
fi

# Check 5: Port 8100 accessible
echo -n "5. Port 8100 (forwarded): "
if curl -s -I http://localhost:8100 --max-time 3 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Accessible${NC}"
else
    echo -e "${RED}✗ Not accessible${NC}"
fi

# Check 6: Images imported
echo -n "6. Docker images in MicroK8s: "
IMAGE_COUNT=$(microk8s ctr images ls -q 2>/dev/null | wc -l)
if [ "$IMAGE_COUNT" -gt 10 ]; then
    echo -e "${GREEN}✓ $IMAGE_COUNT images available${NC}"
else
    echo -e "${YELLOW}⚠ Only $IMAGE_COUNT images (may need re-import)${NC}"
fi

# Check 7: Ingress namespace label
echo -n "7. Ingress namespace label: "
if kubectl get namespace ingress -o jsonpath='{.metadata.labels.app\.kubernetes\.io/name}' 2>/dev/null | grep -q "ingress-nginx"; then
    echo -e "${GREEN}✓ Labeled correctly${NC}"
else
    echo -e "${YELLOW}⚠ Label missing${NC}"
    echo "   Fix: kubectl label namespace ingress app.kubernetes.io/name=ingress-nginx --overwrite"
fi

echo ""
echo "================================================"
echo "SUMMARY"
echo "================================================"
echo ""
echo -e "${GREEN}Persistent (survives reboot):${NC}"
echo "  ✓ MicroK8s cluster"
echo "  ✓ Port 8100 forwarding service"
echo "  ✓ Ingress controller"
echo "  ✓ Docker images in MicroK8s"
echo "  ✓ Network policies"
echo "  ✓ Ingress namespace label"
echo ""
echo -e "${YELLOW}Temporary (needs restart):${NC}"
echo "  • Running lab pods (will be recreated by app)"
echo ""
echo "To test full stack:"
echo "  1. cd /home/letushack/Downloads/tigera/tigera-new"
echo "  2. npm run dev"
echo "  3. Create a lab from the UI"
echo "  4. Lab should be accessible on port 8100"
echo ""
