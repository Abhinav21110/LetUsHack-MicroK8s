#!/bin/bash
# Start port-forward for ingress on port 8100
# This script ensures port-forward keeps running

LOGFILE="/tmp/port-forward-8100.log"

# Kill any existing port-forward on 8100
pkill -f "port-forward.*8100:80" 2>/dev/null

echo "Starting kubectl port-forward for Ingress on port 8100..."
nohup kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 8100:80 > "$LOGFILE" 2>&1 &

PID=$!
echo "Port-forward started with PID: $PID"
echo "Logs: $LOGFILE"

# Wait a moment and test
sleep 3

if curl -s -o /dev/null -w "%{http_code}" http://localhost:8100 | grep -q "404"; then
    echo "✓ SUCCESS! Ingress is accessible at http://localhost:8100"
    echo ""
    echo "To keep this running:"
    echo "  - This process will continue in the background"
    echo "  - To check status: tail -f $LOGFILE"
    echo "  - To stop: pkill -f 'port-forward.*8100:80'"
else
    echo "⚠ Warning: Could not immediately verify connection"
    echo "   The port-forward is running but may need a moment to initialize"
    echo "   Check logs: tail -f $LOGFILE"
fi
