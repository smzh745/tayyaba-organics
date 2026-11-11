#!/usr/bin/env bash
cd "$(dirname "$0")"

PORT=8080
PID=$(lsof -ti :$PORT 2>/dev/null)
if [ -n "$PID" ]; then
    echo "🔄 Freeing port $PORT (stopping previous server process PID: $PID)..."
    kill -9 $PID 2>/dev/null || true
    sleep 0.5
fi

# Detect python3 binary
PYTHON_BIN="python3"
if [ -x "/usr/bin/python3" ]; then
    PYTHON_BIN="/usr/bin/python3"
fi

echo "🌿 Starting Tayyaba Organics Web Store (Pakistan)..."
$PYTHON_BIN server.py
