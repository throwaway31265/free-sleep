#!/bin/bash
# Deploy free-sleep to remote Pod
# Usage: ./scripts/deploy.sh [POD_IP] [PASSWORD]

set -e

POD_IP="${1:-192.168.1.13}"
POD_PASSWORD="${2:-th1s1ss3cur3}"
POD_USER="root"
POD_PORT="8822"
REMOTE_PATH="/home/dac/free-sleep"

echo "==> Building server..."
cd "$(dirname "$0")/../server"
npm run build

echo "==> Deploying to $POD_IP..."
sshpass -p "$POD_PASSWORD" rsync -avz --delete \
    -e "ssh -p $POD_PORT -o StrictHostKeyChecking=no" \
    ./dist/ \
    "$POD_USER@$POD_IP:$REMOTE_PATH/server/dist/"

echo "==> Syncing source files (for potential ts-node dev mode)..."
sshpass -p "$POD_PASSWORD" rsync -avz --delete \
    -e "ssh -p $POD_PORT -o StrictHostKeyChecking=no" \
    ./src/ \
    "$POD_USER@$POD_IP:$REMOTE_PATH/server/src/"

echo "==> Restarting free-sleep service..."
sshpass -p "$POD_PASSWORD" ssh -p $POD_PORT -o StrictHostKeyChecking=no \
    "$POD_USER@$POD_IP" "systemctl restart free-sleep"

echo "==> Waiting for service to start..."
sleep 3

echo "==> Checking service status..."
sshpass -p "$POD_PASSWORD" ssh -p $POD_PORT -o StrictHostKeyChecking=no \
    "$POD_USER@$POD_IP" "systemctl status free-sleep --no-pager | head -20"

echo ""
echo "==> Deploy complete! Testing API..."
sleep 2
curl -s "http://$POD_IP:3000/api/deviceStatus" | python3 -c "import json,sys; d=json.load(sys.stdin); print('Cover:', d.get('coverVersion'), '| Hub:', d.get('hubVersion'))"
