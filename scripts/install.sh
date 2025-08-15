#!/bin/bash
# Free Sleep Installation Script
#
# This script is idempotent - it can be run multiple times safely.
# It will check what's already installed and skip unnecessary steps.
#
# Usage:
#   ./install.sh                    # Install from main branch
#   BRANCH=beta ./install.sh        # Install from beta branch
#   FORCE_UPDATE=true ./install.sh  # Force repository update
#
# Exit immediately on error, on undefined variables, and on error in pipelines
set -euo pipefail

echo "==================================================================="
echo "           Free Sleep Installation Script"
echo "==================================================================="

# --------------------------------------------------------------------------------
# Variables
BRANCH=${BRANCH:-main}

echo "Branch: ${BRANCH}"
echo ""
echo "This script will check and update the following components:"
echo "  - Repository code (skipped if already present)"
echo "  - Bun runtime (skipped if already installed)"
echo "  - Node.js v22.18.0 (skipped if correct version installed)"
echo "  - Server dependencies (includes automatic frontend build)"
echo "  - SystemD service (updated and restarted if needed)"
echo "  - Data directories and migrations"
echo ""
echo "Usage:"
echo "  ./install.sh                    # Install/switch to main branch"
echo "  BRANCH=beta ./install.sh        # Install/switch to beta branch"
echo "  FORCE_UPDATE=true ./install.sh  # Force repository update"
echo "==================================================================="
echo ""
REPO_URL="https://github.com/throwaway31265/free-sleep/archive/refs/heads/${BRANCH}.zip"
ZIP_FILE="free-sleep-${BRANCH}.zip"
REPO_DIR="/home/dac/free-sleep"
SERVER_DIR="$REPO_DIR/server"
USERNAME="dac"

# --------------------------------------------------------------------------------
# Download and update repository
echo "Checking if repository update is needed..."
FORCE_UPDATE=${FORCE_UPDATE:-false}

# Detect current branch if repository exists
CURRENT_BRANCH=""
if [ -d "$REPO_DIR" ] && [ -f "$REPO_DIR/.git-branch-info" ]; then
  CURRENT_BRANCH=$(cat "$REPO_DIR/.git-branch-info" 2>/dev/null || echo "")
fi

# Determine if we need to update
NEEDS_UPDATE=false
REASON=""

if [ "$FORCE_UPDATE" = "true" ]; then
  NEEDS_UPDATE=true
  REASON="Force update requested"
elif [ ! -d "$REPO_DIR" ] || [ ! -f "$REPO_DIR/server/package.json" ]; then
  NEEDS_UPDATE=true
  REASON="Repository not found or incomplete"
elif [ -n "$CURRENT_BRANCH" ] && [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  NEEDS_UPDATE=true
  REASON="Branch switch requested (${CURRENT_BRANCH} → ${BRANCH})"
elif [ -z "$CURRENT_BRANCH" ]; then
  NEEDS_UPDATE=true
  REASON="Branch information missing, updating to ensure correct branch"
else
  # If repo exists and branch matches, compare local vs. remote commit hashes
  # Local commit hash is stored in $REPO_DIR/.git-info when this installer last ran
  LOCAL_COMMIT=""
  if [ -f "$REPO_DIR/.git-info" ]; then
    LOCAL_COMMIT=$(grep -o '"commitHash"[[:space:]]*:[[:space:]]*"[^"]*"' "$REPO_DIR/.git-info" 2>/dev/null | cut -d'"' -f4 || true)
  elif [ -f "$SERVER_DIR/.git-info" ]; then
    LOCAL_COMMIT=$(grep -o '"commitHash"[[:space:]]*:[[:space:]]*"[^"]*"' "$SERVER_DIR/.git-info" 2>/dev/null | cut -d'"' -f4 || true)
  fi

  # Fetch the latest commit hash for the branch from GitHub if curl is available
  REMOTE_COMMIT=""
  if command -v curl >/dev/null 2>&1; then
    GITHUB_API_URL="https://api.github.com/repos/throwaway31265/free-sleep/commits/${BRANCH}"
    # Use a short timeout to avoid hanging the installer (if available)
    if command -v timeout >/dev/null 2>&1; then
      COMMIT_DATA=$(timeout 8s curl -s "$GITHUB_API_URL" 2>/dev/null) || COMMIT_DATA=""
    else
      COMMIT_DATA=$(curl -s "$GITHUB_API_URL" 2>/dev/null) || COMMIT_DATA=""
    fi
    if [ -n "$COMMIT_DATA" ]; then
      # Extract full SHA then trim to 8 chars to match stored format
      REMOTE_COMMIT=$(echo "$COMMIT_DATA" | sed -n 's/.*"sha": *"\([^"]*\)".*/\1/p' | head -1 | cut -c1-8 || true)
    fi
  fi

  # If we successfully fetched a remote commit and it differs from local, update
  if [ -n "$REMOTE_COMMIT" ]; then
    if [ -z "$LOCAL_COMMIT" ]; then
      NEEDS_UPDATE=true
      REASON="Local commit unknown; remote has ${REMOTE_COMMIT}"
    elif [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
      NEEDS_UPDATE=true
      REASON="Repository is behind (${LOCAL_COMMIT} → ${REMOTE_COMMIT})"
    fi
  fi
fi

if [ "$NEEDS_UPDATE" = "true" ]; then
  echo "Updating repository: $REASON"
  echo "Downloading the repository from branch '${BRANCH}'..."
  curl -L -o "$ZIP_FILE" "$REPO_URL"

  echo "Unzipping the repository..."
  unzip -o -q "$ZIP_FILE"
  echo "Removing the zip file..."
  rm -f "$ZIP_FILE"

  # Clean up existing directory and move new code into place
  echo "Setting up the installation directory..."
  rm -rf "$REPO_DIR"
  mv "free-sleep-${BRANCH}" "$REPO_DIR"

  # Store branch information for future detection
  echo "$BRANCH" > "$REPO_DIR/.git-branch-info"

  # Create comprehensive git info file for the server API
  echo "Creating git information file..."

  # Get the latest commit info from the downloaded repository
  COMMIT_HASH=""
  COMMIT_TITLE=""

  # Try to get commit info from GitHub API (works without git being installed)
  if command -v curl >/dev/null 2>&1; then
    echo "Fetching latest commit information from GitHub..."
    GITHUB_API_URL="https://api.github.com/repos/throwaway31265/free-sleep/commits/${BRANCH}"

        # Fetch commit info with timeout and better error handling
        if COMMIT_DATA=$(timeout 10s curl -s -w "HTTP_CODE:%{http_code}" "$GITHUB_API_URL" 2>/dev/null); then
      HTTP_CODE=$(echo "$COMMIT_DATA" | grep -o 'HTTP_CODE:[0-9]*' | cut -d':' -f2 | tr -d '[:space:]')
      COMMIT_DATA=$(echo "$COMMIT_DATA" | sed 's/HTTP_CODE:[0-9]*$//')

      if [ "$HTTP_CODE" = "200" ]; then
        # Parse JSON response using basic tools (no jq dependency)
        # Extract SHA (should be near the beginning)
        COMMIT_HASH=$(echo "$COMMIT_DATA" | sed -n 's/.*"sha": *"\([^"]*\)".*/\1/p' | head -1 | head -c 8 || true)
        # Extract message (nested in commit object) - handle JSON escaped content properly
        COMMIT_TITLE=$(echo "$COMMIT_DATA" | sed -n 's/.*"message": *"\([^"]*\(\\.[^"]*\)*\)".*/\1/p' | head -1 || true)

        # Clean up commit title (remove escaped characters and truncate properly)
        COMMIT_TITLE=$(echo "$COMMIT_TITLE" | sed 's/\\n/ - /g' | sed 's/\\"/"/g' | sed 's/\\t/ /g' | head -c 100 || true)
      else
        echo "GitHub API returned HTTP $HTTP_CODE, using fallback values"
      fi
    else
      echo "Failed to fetch commit info from GitHub API (network/timeout), using fallback values"
    fi
  fi

  # Alternative: Try to get commit info from package.json if it exists
  if [ -z "$COMMIT_HASH" ] && [ -f "$REPO_DIR/server/package.json" ]; then
    echo "Trying to extract version info from package.json..."
    PACKAGE_VERSION=$(grep -o '"version":[[:space:]]*"[^"]*"' "$REPO_DIR/server/package.json" 2>/dev/null | cut -d'"' -f4 || true)
    if [ -n "$PACKAGE_VERSION" ]; then
      COMMIT_HASH="${PACKAGE_VERSION:0:8}"
      COMMIT_TITLE="Version $PACKAGE_VERSION from ${BRANCH} branch"
    fi
  fi

  # Fallback values if all methods failed
  if [ -z "$COMMIT_HASH" ]; then
    COMMIT_HASH="unknown"
  fi
  if [ -z "$COMMIT_TITLE" ]; then
    COMMIT_TITLE="Latest commit from ${BRANCH} branch"
  fi

  # Create git info JSON file
  cat > "$REPO_DIR/.git-info" <<EOF
{
  "branch": "${BRANCH}",
  "commitHash": "${COMMIT_HASH}",
  "commitTitle": "${COMMIT_TITLE}",
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")"
}
EOF

  # Also create git info in server directory for API access
  cp "$REPO_DIR/.git-info" "$SERVER_DIR/.git-info" 2>/dev/null || true

  chown -R "$USERNAME":"$USERNAME" "$REPO_DIR"
  echo "Repository updated successfully from branch '${BRANCH}'."
  echo "Commit: ${COMMIT_HASH} - ${COMMIT_TITLE}"
else
  echo "Repository already exists and is on the correct branch '${BRANCH}'. Skipping download."
  echo "Set FORCE_UPDATE=true to force repository update."
fi

# --------------------------------------------------------------------------------
# Install or update Bun
# - We check once. If it’s not installed, install it.
echo "Checking if Bun is installed for user '$USERNAME'..."
if sudo -u "$USERNAME" bash -c 'command -v bun' >/dev/null 2>&1; then
  echo "Bun is already installed for user '$USERNAME'."
else
  echo "Bun is not installed. Installing for user '$USERNAME'..."
  sudo -u "$USERNAME" bash -c 'curl -fsSL https://bun.sh/install | bash'
  # Ensure Bun environment variables are in the DAC user’s profile:
  if ! grep -q 'export BUN_INSTALL=' "/home/$USERNAME/.profile"; then
    echo -e '\nexport BUN_INSTALL="/home/dac/.bun"\nexport PATH="$BUN_INSTALL/bin:$PATH"\n' \
      >>"/home/$USERNAME/.profile"
  fi
fi

# --------------------------------------------------------------------------------
# Update Node.js to version 22 (with Volta support)
echo "Checking Node.js version..."
NODE_VERSION="22.18.0"
CURRENT_NODE_VERSION=""
VOLTA_DETECTED=false

# Check if Volta is managing Node.js for the user
if sudo -u "$USERNAME" bash -c 'command -v volta' >/dev/null 2>&1; then
  VOLTA_DETECTED=true
  echo "Volta detected for user '$USERNAME'."
  CURRENT_NODE_VERSION=$(sudo -u "$USERNAME" bash -c 'node -v 2>/dev/null | sed "s/v//"' || echo "")
else
  # Check system Node.js
  if command -v node >/dev/null 2>&1; then
    CURRENT_NODE_VERSION=$(node -v | sed 's/v//')
  fi
fi

if [ "$CURRENT_NODE_VERSION" = "$NODE_VERSION" ]; then
  echo "Node.js v$NODE_VERSION is already installed. Skipping update."
elif [ "$VOLTA_DETECTED" = true ]; then
  echo "Using Volta to install Node.js v$NODE_VERSION for user '$USERNAME'..."
  sudo -u "$USERNAME" bash -c "volta install node@$NODE_VERSION"
  echo "Node.js updated successfully via Volta."
else
  echo "Installing system Node.js to version $NODE_VERSION..."
  NODE_TARBALL="node-v${NODE_VERSION}-linux-arm64.tar.gz"
  NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}"

  # Download and install Node.js v22
  wget "$NODE_URL"
  tar -xzf "$NODE_TARBALL"
  cp "node-v${NODE_VERSION}-linux-arm64/bin/node" /usr/bin/node
  chmod +x /usr/bin/node

  # Clean up downloaded files
  rm -rf "$NODE_TARBALL" "node-v${NODE_VERSION}-linux-arm64"

  echo "Node.js updated successfully."
fi

# Verify installation
echo "Current Node.js version:"
if [ "$VOLTA_DETECTED" = true ]; then
  sudo -u "$USERNAME" bash -c 'node -v' || echo "Node.js not found"
else
  node -v || echo "Node.js not found"
fi

# --------------------------------------------------------------------------------
# Setup /persistent/free-sleep-data (migrate old configs, logs, etc.)
echo "Setting up persistent data directories..."
mkdir -p /persistent/free-sleep-data/logs/
mkdir -p /persistent/free-sleep-data/lowdb/

# Extract the DAC_SOCKET path from frank.sh (if present) and put it in DAC_SOCK_PATH file
if [ -f /opt/eight/bin/frank.sh ] && [ ! -f /persistent/free-sleep-data/dac_sock_path.txt ]; then
  echo "Extracting DAC socket path from frank.sh..."
  grep -oP '(?<=DAC_SOCKET=)[^ ]*dac.sock' /opt/eight/bin/frank.sh >/persistent/free-sleep-data/dac_sock_path.txt || echo "Could not extract DAC socket path"
elif [ -f /persistent/free-sleep-data/dac_sock_path.txt ]; then
  echo "DAC socket path already configured."
else
  echo "WARNING: frank.sh not found, DAC socket path not configured."
fi

# DO NOT REMOVE, OLD VERSIONS WILL LOSE settings & schedules
FILES_TO_MOVE=(
  "/home/dac/free-sleep-database/settingsDB.json:/persistent/free-sleep-data/lowdb/settingsDB.json"
  "/home/dac/free-sleep-database/schedulesDB.json:/persistent/free-sleep-data/lowdb/schedulesDB.json"
  "/home/dac/dac_sock_path.txt:/persistent/free-sleep-data/dac_sock_path.txt"
)

for entry in "${FILES_TO_MOVE[@]}"; do
  IFS=":" read -r SOURCE_FILE DESTINATION <<<"$entry"
  if [ -f "$SOURCE_FILE" ]; then
    mv "$SOURCE_FILE" "$DESTINATION"
    echo "Moved $SOURCE_FILE to $DESTINATION"
  fi
done

# Change ownership and permissions
chown -R "$USERNAME":"$USERNAME" /persistent/free-sleep-data/
chmod 770 /persistent/free-sleep-data/
chmod g+s /persistent/free-sleep-data/

# --------------------------------------------------------------------------------
# Install server dependencies (with IPv6 hang workaround)
echo "Checking server dependencies..."

# Check if node_modules exists and has contents
if [ -d "$SERVER_DIR/node_modules" ] && [ "$(ls -A $SERVER_DIR/node_modules)" ]; then
  echo "Dependencies appear to be installed. Checking if update is needed..."

  # Ensure bun directory has correct ownership
  if [ -d "/home/$USERNAME/.bun" ]; then
    chown -R "$USERNAME":"$USERNAME" "/home/$USERNAME/.bun" || true
  fi

  # Run bun install anyway to update/verify dependencies, but with shorter timeout
  if command -v timeout >/dev/null 2>&1; then
    echo "Running bun install to verify/update dependencies..."
    sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && timeout 60s /home/$USERNAME/.bun/bin/bun install" || echo "Dependency check completed (may have been interrupted)"
  else
    sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.bun/bin/bun install"
  fi
else
  echo "Installing dependencies in $SERVER_DIR ..."

  # Fix potential permission issues with bun cache directory
  echo "Ensuring bun cache directory has correct ownership..."
  if [ -d "/home/$USERNAME/.bun" ]; then
    chown -R "$USERNAME":"$USERNAME" "/home/$USERNAME/.bun" || true
  fi

  if command -v timeout >/dev/null 2>&1; then
    echo "Running bun install with a 180s timeout to detect hangs..."
    if ! sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && timeout 180s /home/$USERNAME/.bun/bin/bun install"; then
      echo "bun install failed or timed out. Clearing cache and applying workarounds..."

      # Clear bun cache to resolve permission issues
      echo "Clearing bun cache..."
      sudo -u "$USERNAME" bash -c "/home/$USERNAME/.bun/bin/bun pm cache rm" || true

      # Disable IPv6 (runtime)
      sysctl -w net.ipv6.conf.all.disable_ipv6=1 || true
      sysctl -w net.ipv6.conf.default.disable_ipv6=1 || true
      sysctl -w net.ipv6.conf.lo.disable_ipv6=1 || true
      # Persist IPv6 disable across reboots
      if [ -f /etc/sysctl.conf ]; then
        sed -i '/net.ipv6.conf.all.disable_ipv6/d' /etc/sysctl.conf || true
        sed -i '/net.ipv6.conf.default.disable_ipv6/d' /etc/sysctl.conf || true
        sed -i '/net.ipv6.conf.lo.disable_ipv6/d' /etc/sysctl.conf || true
        echo 'net.ipv6.conf.all.disable_ipv6=1' >> /etc/sysctl.conf
        echo 'net.ipv6.conf.default.disable_ipv6=1' >> /etc/sysctl.conf
        echo 'net.ipv6.conf.lo.disable_ipv6=1' >> /etc/sysctl.conf
        sysctl -p || true
      fi

      # Ensure ownership is correct again after cache clear
      chown -R "$USERNAME":"$USERNAME" "/home/$USERNAME/.bun" || true

      # Retry bun install
      echo "Retrying bun install..."
      if ! sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.bun/bin/bun install"; then
        echo "ERROR: bun install failed after applying workarounds."
        echo "This could be due to:"
        echo "  1. Network connectivity issues"
        echo "  2. Disk space issues"
        echo "  3. ARM64 architecture compatibility issues"
        echo "  4. File system permission issues"
        echo ""
        echo "You can try the following manual steps:"
        echo "  1. Check disk space: df -h"
        echo "  2. Clear all bun cache: sudo -u $USERNAME /home/$USERNAME/.bun/bin/bun pm cache clear"
        echo "  3. Remove node_modules: rm -rf '$SERVER_DIR/node_modules'"
        echo "  4. Try installing manually: cd '$SERVER_DIR' && sudo -u $USERNAME /home/$USERNAME/.bun/bin/bun install"
        echo ""
        exit 1
      fi
    fi
  else
    echo "'timeout' command not found. Running bun install normally. If it hangs at 'Resolving...', run /home/dac/free-sleep/scripts/disable_ipv6.sh and re-run the installer."
    # Still fix permissions even without timeout
    chown -R "$USERNAME":"$USERNAME" "/home/$USERNAME/.bun" || true
    sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.bun/bin/bun install"
  fi
fi

echo "Running Prisma migrations..."
# Ensure Bun is in PATH for nested spawns inside the npm script (dotenv -> bun x ...)
sudo -u "$USERNAME" bash -lc "export BUN_INSTALL=/home/$USERNAME/.bun; export PATH=/home/$USERNAME/.bun/bin:$PATH; cd '$SERVER_DIR' && bun run migrate deploy"

echo "Note: Frontend application will be built automatically via postinstall script."

# --------------------------------------------------------------------------------
# Create systemd service

SERVICE_FILE="/etc/systemd/system/free-sleep.service"

if systemctl is-enabled free-sleep.service >/dev/null 2>&1; then
  echo "Free Sleep service is already configured. Checking if restart is needed..."

  # Always update the service file in case there are changes
  echo "Updating systemd service file at $SERVICE_FILE..."

  # Build PATH with Volta support if detected
  SERVICE_PATH="/home/$USERNAME/.bun/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin"
  if [ "$VOLTA_DETECTED" = true ]; then
    SERVICE_PATH="/home/$USERNAME/.volta/bin:$SERVICE_PATH"
  fi

  cat >"$SERVICE_FILE" <<EOF
[Unit]
Description=Free Sleep Server
After=network.target

[Service]
ExecStart=/home/$USERNAME/.bun/bin/bun run dev
WorkingDirectory=$SERVER_DIR
Restart=always
User=$USERNAME
Environment=NODE_ENV=production
Environment=BUN_INSTALL=/home/$USERNAME/.bun
Environment=PATH=$SERVICE_PATH

[Install]
WantedBy=multi-user.target
EOF

  echo "Reloading systemd daemon..."
  systemctl daemon-reload

  if systemctl is-active free-sleep.service >/dev/null 2>&1; then
    echo "Restarting free-sleep.service..."
    systemctl restart free-sleep.service
  else
    echo "Starting free-sleep.service..."
    systemctl start free-sleep.service
  fi
else
  echo "Creating systemd service file at $SERVICE_FILE..."

  # Build PATH with Volta support if detected
  SERVICE_PATH="/home/$USERNAME/.bun/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin"
  if [ "$VOLTA_DETECTED" = true ]; then
    SERVICE_PATH="/home/$USERNAME/.volta/bin:$SERVICE_PATH"
  fi

  cat >"$SERVICE_FILE" <<EOF
[Unit]
Description=Free Sleep Server
After=network.target

[Service]
ExecStart=/home/$USERNAME/.bun/bin/bun run dev
WorkingDirectory=$SERVER_DIR
Restart=always
User=$USERNAME
Environment=NODE_ENV=production
Environment=BUN_INSTALL=/home/$USERNAME/.bun
Environment=PATH=$SERVICE_PATH

[Install]
WantedBy=multi-user.target
EOF

  echo "Reloading systemd daemon and enabling the service..."
  systemctl daemon-reload
  systemctl enable free-sleep.service

  echo "Starting free-sleep.service..."
  systemctl start free-sleep.service
fi

echo "Checking service status..."
systemctl status free-sleep.service --no-pager || true

# --------------------------------------------------------------------------------
# Graceful device time update (optional)

echo "Attempting to update device time from Google..."
# If the curl fails or is blocked, skip with a warning but don't fail the entire script
if date_string="$(curl -s --head http://google.com | grep '^Date: ' | sed 's/Date: //g')" && [ -n "$date_string" ]; then
  date -s "$date_string" || echo "WARNING: Unable to update system time"
else
  echo -e "\033[0;33mWARNING: Unable to retrieve date from Google... Skipping time update.\033[0m"
fi

# --------------------------------------------------------------------------------
# Setup passwordless reboot for 'dac'

SUDOERS_FILE="/etc/sudoers.d/$USERNAME"
SUDOERS_RULE="$USERNAME ALL=(ALL) NOPASSWD: /sbin/reboot"

if sudo grep -Fxq "$SUDOERS_RULE" "$SUDOERS_FILE" 2>/dev/null; then
  echo "Rule for '$USERNAME' reboot permissions already exists."
else
  echo "$SUDOERS_RULE" | sudo tee "$SUDOERS_FILE" >/dev/null
  sudo chmod 440 "$SUDOERS_FILE"
  echo "Passwordless permission for reboot granted to '$USERNAME'."
fi

echo ""

# --------------------------------------------------------------------------------
# Restart free-sleep-stream if it exists

if systemctl list-units --full --all | grep -q "free-sleep-stream"; then
  echo "Restarting free-sleep-stream service..."
  systemctl restart free-sleep-stream
else
  echo "free-sleep-stream service does not exist. Skipping restart."
fi

echo ""

# --------------------------------------------------------------------------------
# Finish
echo "==================================================================="
echo "           Installation Summary"
echo "==================================================================="

# Show current branch information
INSTALLED_BRANCH="unknown"
if [ -f "$REPO_DIR/.git-branch-info" ]; then
  INSTALLED_BRANCH=$(cat "$REPO_DIR/.git-branch-info" 2>/dev/null || echo "unknown")
fi

echo "Repository branch: $INSTALLED_BRANCH"
echo ""
echo "This is your dac.sock path (if it doesn't end in dac.sock, contact support):"
cat /persistent/free-sleep-data/dac_sock_path.txt 2>/dev/null || echo "No dac.sock path found."

echo ""
echo "Current versions:"
if [ "$VOLTA_DETECTED" = true ]; then
  echo "  - Node.js: $(sudo -u "$USERNAME" bash -c 'node -v' 2>/dev/null || echo 'Not found') (managed by Volta)"
else
  echo "  - Node.js: $(node -v 2>/dev/null || echo 'Not found') (system)"
fi
echo "  - Bun: $(sudo -u "$USERNAME" bash -c '/home/dac/.bun/bin/bun --version' 2>/dev/null || echo 'Not found')"

echo ""
echo -e "\033[0;32mInstallation complete! The Free Sleep server is running and will start automatically on boot.\033[0m"
echo -e "\033[0;32mSee logs with: journalctl -u free-sleep --no-pager --output=cat\033[0m"
echo ""
echo "To re-run this script safely:"
echo "  ./install.sh                    # Install/switch to main branch"
echo "  BRANCH=beta ./install.sh        # Install/switch to beta branch"
echo "  FORCE_UPDATE=true ./install.sh  # Force repository update"
echo "==================================================================="
