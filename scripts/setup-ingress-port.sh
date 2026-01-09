#!/bin/bash

echo "================================================"
echo "  Setting up Ingress Port Forward (8100 → 80)"
echo "================================================"

# Kill any existing port forwards
pkill -f "rinetd.*8100" 2>/dev/null
pkill -f "socat.*8100" 2>/dev/null

# Check if socat is installed
if command -v socat &> /dev/null; then
    echo "Using socat for port forwarding..."
    nohup socat TCP-LISTEN:8100,fork,reuseaddr TCP:127.0.0.1:80 > /tmp/port-forward-8100.log 2>&1 &
    PID=$!
    echo "Port forward started (PID: $PID)"
    echo "$PID" > /tmp/port-forward-8100.pid
    
    sleep 2
    
    # Test it
    if curl -s http://localhost:8100 > /dev/null 2>&1; then
        echo "✓ Port 8100 is now accessible!"
    else
        echo "✗ Port forward may not be working, check /tmp/port-forward-8100.log"
    fi
else
    echo "socat not installed. Installing..."
    sudo apt-get update && sudo apt-get install -y socat
    
    echo "Starting port forward..."
    nohup socat TCP-LISTEN:8100,fork,reuseaddr TCP:127.0.0.1:80 > /tmp/port-forward-8100.log 2>&1 &
    PID=$!
    echo "Port forward started (PID: $PID)"
    echo "$PID" > /tmp/port-forward-8100.pid
fi

echo ""
echo "To stop port forward:"
echo "  kill \$(cat /tmp/port-forward-8100.pid)"
echo ""
echo "To check status:"
echo "  curl http://localhost:8100"
echo ""
