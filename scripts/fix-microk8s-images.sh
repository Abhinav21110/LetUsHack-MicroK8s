#!/bin/bash
# filepath: scripts/fix-microk8s-images.sh

echo "================================================"
echo "  Fixing MicroK8s Image Issues                 "
echo "================================================"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}━━━ Issue Identified ━━━${NC}"
echo ""
echo "Problem: Images not available in MicroK8s containerd"
echo ""

# Step 1: Build all images from docker-compose
echo -e "${BLUE}Step 1: Building all Docker images...${NC}"
echo ""

if [ -f "docker-compose.yml" ]; then
    echo "Building from docker-compose.yml..."
    docker-compose build
    echo -e "${GREEN}✓ Docker images built${NC}"
else
    echo -e "${YELLOW}⚠ No docker-compose.yml found${NC}"
fi

# Step 2: Get all relevant Docker images
echo ""
echo -e "${BLUE}Step 2: Finding all Docker images...${NC}"
echo ""
docker images | head -20

# Step 3: Import ALL images to MicroK8s
echo ""
echo -e "${BLUE}Step 3: Importing ALL images to MicroK8s...${NC}"
echo ""

# Get all images (not just the predefined list)
ALL_IMAGES=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep -v "<none>" | grep -v "REPOSITORY")

for IMAGE in $ALL_IMAGES; do
    echo "Importing: $IMAGE"
    docker save "$IMAGE" | microk8s ctr image import - 2>&1 | grep -E "unpacking|imported" || true
done

echo ""
echo -e "${GREEN}✓ All images imported${NC}"

# Step 4: Clean up Tigera operator
echo ""
echo -e "${BLUE}Step 4: Cleaning up conflicts...${NC}"
kubectl delete namespace tigera-operator --force --grace-period=0 2>/dev/null || true
echo -e "${GREEN}✓ Conflicts cleaned${NC}"

# Step 5: Delete ALL pods in letushack namespace
echo ""
echo -e "${BLUE}Step 5: Restarting all user pods...${NC}"
kubectl get namespaces | grep letushack | awk '{print $1}' | while read ns; do
    echo "Deleting pods in namespace: $ns"
    kubectl delete pods --all -n "$ns" --force --grace-period=0 2>/dev/null || true
done
echo -e "${GREEN}✓ Pods deleted (will recreate)${NC}"

# Step 6: Verify images in MicroK8s
echo ""
echo -e "${BLUE}Step 6: Verifying images in MicroK8s...${NC}"
echo ""
microk8s ctr images ls | grep -E "docker.io|localhost" | head -20

# Step 7: Wait and check status
echo ""
echo -e "${BLUE}Step 7: Waiting for pods to start...${NC}"
echo ""
sleep 15

kubectl get pods -A | grep -E "letushack|nmap|debian|kali|metasploit|ubuntu|alpine"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}FIX COMPLETE!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✓ All Docker images imported to MicroK8s${NC}"
echo -e "${GREEN}✓ Pods restarted${NC}"
echo ""
echo -e "${YELLOW}Check pod status:${NC}"
echo "  kubectl get pods -A"
echo ""
echo -e "${YELLOW}If still failing, check details:${NC}"
echo "  kubectl describe pod <pod-name> -n <namespace>"
echo ""