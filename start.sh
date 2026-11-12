#!/usr/bin/env bash

# Move to script directory
cd "$(dirname "$0")"

PORT=8000

echo "=================================================="
echo " Starting Clinical Lead Generator..."
echo "=================================================="

# Check for Node.js runtime (preferred) or Python
if command -v node >/dev/null 2>&1 && [ -f "server.js" ]; then
    echo "[*] Launching with Node.js runtime..."
    RUN_CMD="node server.js"
else
    # Fallback to Python virtual environment
    if [ ! -d "venv" ]; then
        echo "[*] Creating virtual environment..."
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
    else
        source venv/bin/activate
    fi
    RUN_CMD="python3 main.py"
fi

# Ensure port 8000 is free before starting
EXISTING_PID=$(fuser $PORT/tcp 2>/dev/null)
if [ -n "$EXISTING_PID" ]; then
    echo "[*] Freeing port $PORT (PID: $EXISTING_PID)..."
    kill -9 $EXISTING_PID 2>/dev/null
    sleep 1
fi

# Detect LAN IP
LAN_IP=$(ip -4 addr show scope global | grep -v 'tailscale' | awk '/inet /{print $2}' | cut -d/ -f1 | head -n 1)

# Detect Tailscale IP
TAILSCALE_IP=$(ip -4 addr show dev tailscale0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 | head -n 1)

echo ""
echo "--------------------------------------------------"
echo " Application is running on 0.0.0.0:$PORT"
echo ""
echo " Access links:"
echo "   • Local:      http://localhost:$PORT"

if [ -n "$LAN_IP" ]; then
    echo "   • Local LAN:  http://$LAN_IP:$PORT"
fi

if [ -n "$TAILSCALE_IP" ]; then
    echo "   • Tailscale:  http://$TAILSCALE_IP:$PORT"
fi

echo ""
echo " Press CTRL+C to stop."
echo "--------------------------------------------------"
echo ""
echo "[*] Live Server Logs:"
echo ""

# Start server on 0.0.0.0 so all interfaces can connect
PORT="$PORT" exec $RUN_CMD
