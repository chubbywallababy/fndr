#!/bin/bash
set -e

SERVER="root@134.199.197.81"
REMOTE_PATH="/root/fndr"

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

echo "Starting deployment to $SERVER..."

# Create remote directory
echo "Creating remote directory..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER "mkdir -p $REMOTE_PATH"

# Upload the bundled cron file (contains all pure-JS deps)
echo "Uploading bundled cron.js..."
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no dist/cron.js $SERVER:$REMOTE_PATH/

# Check if node_modules already exists on server
echo "Checking if native dependencies are installed..."
MODULES_EXIST=$(sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER "[ -d $REMOTE_PATH/node_modules ] && echo 'yes' || echo 'no'")

if [ "$MODULES_EXIST" = "no" ]; then
    echo "First deploy - installing native dependencies..."
    
    # Upload minimal package.json for native dependencies only
    sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no scripts/cron-package.json $SERVER:$REMOTE_PATH/package.json
    
    # Install native dependencies on server (canvas, tesseract.js, pdf2pic)
    sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER "cd $REMOTE_PATH && npm install --omit=dev"
else
    echo "Native dependencies already installed - skipping npm install"
fi

# Set up cron job (daily at 6 AM)
echo "Setting up cron job..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER "echo '0 6 * * * cd $REMOTE_PATH && node cron.js >> /var/log/fndr-cron.log 2>&1' | crontab -"

echo ""
echo "Deployment complete!"
echo ""
echo "Next steps:"
echo "1. SSH into server: ssh $SERVER"
echo "2. Create .env file: echo 'FNDR_SLACK_WEBHOOK_URL=your_webhook_url' > $REMOTE_PATH/.env"
echo "3. Verify cron: crontab -l"
echo "4. Test manually: cd $REMOTE_PATH && node cron.js"
