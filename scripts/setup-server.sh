#!/bin/bash
set -e

SERVER="root@134.199.197.81"

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    echo "Error: sshpass is not installed."
    echo "Install it with: brew install hudochenkov/sshpass/sshpass"
    exit 1
fi

# Prompt for password
echo -n "Enter SSH password for $SERVER: "
read -s PASSWORD
echo ""

echo "Setting up server $SERVER..."
echo "This will install Node.js, Ghostscript, GraphicsMagick, and canvas dependencies."
echo ""

sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER bash <<'REMOTE_SCRIPT'
set -e

echo "Updating package lists..."
apt-get update

echo "Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "Installing pdf2pic dependencies (ghostscript, graphicsmagick)..."
apt-get install -y ghostscript graphicsmagick

echo "Installing canvas dependencies..."
apt-get install -y build-essential libcairo2-dev libpango1.0-dev \
  libjpeg-dev libgif-dev librsvg2-dev

echo "Creating app directory..."
mkdir -p /root/fndr

echo ""
echo "Verifying installations..."
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Ghostscript: $(gs --version)"
echo "GraphicsMagick: $(gm version | head -1)"

echo ""
echo "Server setup complete!"
REMOTE_SCRIPT

echo ""
echo "Server setup finished successfully!"
echo "You can now run: npm run deploy:cron"
