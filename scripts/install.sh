#!/bin/bash
# install.sh - Install Auto-Retry as macOS LaunchAgent (auto-start on login)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_NAME="com.antigravity.autoretry"
PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
LOG_DIR="$HOME/Library/Logs/AntigravityAutoRetry"
NODE_PATH=$(which node)

echo "🔧 Installing Antigravity Auto-Retry..."
echo "   Script dir: $SCRIPT_DIR"
echo "   Node path:  $NODE_PATH"

# Check Node.js
if [ -z "$NODE_PATH" ]; then
  echo "❌ Node.js not found. Please install Node.js >= 18."
  exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
cd "$SCRIPT_DIR" && npm install --production

# Create log directory
mkdir -p "$LOG_DIR"

# Generate plist with correct paths
cat > "$PLIST_DST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$SCRIPT_DIR/src/core/auto-retry.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/stderr.log</string>
    <key>WorkingDirectory</key>
    <string>$SCRIPT_DIR</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    </dict>
</dict>
</plist>
EOF

echo "📋 LaunchAgent plist created at: $PLIST_DST"

# Load the agent
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"

echo ""
echo "✅ Installation complete!"
echo ""
echo "   Status:  launchctl list | grep autoretry"
echo "   Logs:    tail -f $LOG_DIR/stdout.log"
echo "   Stop:    launchctl unload $PLIST_DST"
echo "   Start:   launchctl load $PLIST_DST"
echo "   Remove:  npm run uninstall-agent"
