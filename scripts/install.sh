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

# --------------------------------------------------------------------------------
# Helper Functions
# --------------------------------------------------------------------------------

# Fetch commit info from GitHub API with timeout and error handling
fetch_github_commit_info() {
  local branch="$1"
  local timeout_seconds="${2:-10}"

  if ! command -v curl >/dev/null 2>&1; then
    return 1
  fi

  local github_api_url="https://api.github.com/repos/throwaway31265/free-sleep/commits/${branch}"
  local commit_data=""

  if command -v timeout >/dev/null 2>&1; then
    commit_data=$(timeout "${timeout_seconds}s" curl -s -w "HTTP_CODE:%{http_code}" "$github_api_url" 2>/dev/null) || return 1
  else
    commit_data=$(curl -s -w "HTTP_CODE:%{http_code}" "$github_api_url" 2>/dev/null) || return 1
  fi

  local http_code
  http_code=$(echo "$commit_data" | grep -o 'HTTP_CODE:[0-9]*' | cut -d':' -f2 | tr -d '[:space:]')
  commit_data=$(echo "$commit_data" | sed 's/HTTP_CODE:[0-9]*$//')

  if [ "$http_code" = "200" ]; then
    # Extract SHA and truncate to 8 chars
    COMMIT_HASH=$(echo "$commit_data" | sed -n 's/.*"sha": *"\([^"]*\)".*/\1/p' | head -1 | head -c 8 || true)
    # Extract commit message
    COMMIT_TITLE=$(echo "$commit_data" | sed -n 's/.*"message": *"\([^"]*\(\\.[^"]*\)*\)".*/\1/p' | head -1 || true)
    # Clean up commit title
    COMMIT_TITLE=$(echo "$COMMIT_TITLE" | sed 's/\\n/ - /g' | sed 's/\\"/"/g' | sed 's/\\t/ /g' | head -c 100 || true)
    return 0
  fi

  return 1
}

# Ensure bun directory ownership is correct
fix_bun_ownership() {
  local username="$1"
  if [ -d "/home/$username/.bun" ]; then
    chown -R "$username":"$username" "/home/$username/.bun" || true
  fi
}

# Run command as user with optional timeout
run_as_user_with_timeout() {
  local username="$1"
  local timeout_seconds="$2"
  local command="$3"

  if [ "$timeout_seconds" -gt 0 ] && command -v timeout >/dev/null 2>&1; then
    timeout "${timeout_seconds}s" sudo -u "$username" bash -c "$command"
  else
    sudo -u "$username" bash -c "$command"
  fi
}

# Build PATH for systemd service
build_service_path() {
  local username="$1"
  local volta_detected="$2"

  local service_path="/home/$username/.bun/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin"
  if [ "$volta_detected" = true ]; then
    service_path="/home/$username/.volta/bin:$service_path"
  fi
  echo "$service_path"
}

# Create systemd service file
create_systemd_service() {
  local service_file="$1"
  local username="$2"
  local server_dir="$3"
  local service_path="$4"

  cat >"$service_file" <<EOF
[Unit]
Description=Free Sleep Server
After=network.target

[Service]
ExecStart=/home/$username/.bun/bin/bun run dev
WorkingDirectory=$server_dir
Restart=always
User=$username
Environment=NODE_ENV=production
Environment=BUN_INSTALL=/home/$username/.bun
Environment=PATH=$service_path

[Install]
WantedBy=multi-user.target
EOF
}

# Apply IPv6 workarounds for bun install issues
apply_ipv6_workarounds() {
  echo "Applying IPv6 workarounds..."
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
}

# Check service status and store for later restoration
check_and_store_service_status() {
  local service_name="$1"
  local status_var="$2"

  if systemctl list-units --full --all | grep -q "${service_name}\.service"; then
    if systemctl is-active "$service_name" >/dev/null 2>&1; then
      eval "$status_var=running"
      echo "$service_name service exists and is running - will be restarted after installation"
    else
      eval "$status_var=stopped"
      echo "$service_name service exists but is stopped - will remain stopped"
    fi
  else
    eval "$status_var=nonexistent"
    echo "$service_name service does not exist - will not be managed"
  fi
}

# Stop services before installation
stop_services_for_installation() {
  echo "Stopping Free Sleep services for installation..."

  local services=("free-sleep" "free-sleep-stream")

  for service in "${services[@]}"; do
    if systemctl list-units --full --all | grep -q "${service}\.service"; then
      if systemctl is-active "$service" >/dev/null 2>&1; then
        echo "Stopping $service service..."
        systemctl stop "$service" || true
      fi
    fi
  done
}

# Start services after installation based on their previous state
start_services_after_installation() {
  echo "Restoring Free Sleep services to their previous state..."

  if [ "$FREE_SLEEP_PREVIOUS_STATUS" = "running" ]; then
    echo "Restarting free-sleep service (was previously running)..."
    systemctl start free-sleep || echo "Failed to start free-sleep service"
  fi

  if [ "$FREE_SLEEP_STREAM_PREVIOUS_STATUS" = "running" ]; then
    echo "Restarting free-sleep-stream service (was previously running)..."
    systemctl start free-sleep-stream || echo "Failed to start free-sleep-stream service"
  fi
}

echo "==================================================================="
echo "           Free Sleep Installation Script"
echo "==================================================================="

# --------------------------------------------------------------------------------
# Variables
BRANCH=${BRANCH:-main}

# Check current status of Free Sleep services before starting installation
echo "Checking current service status..."
check_and_store_service_status "free-sleep" "FREE_SLEEP_PREVIOUS_STATUS"
check_and_store_service_status "free-sleep-stream" "FREE_SLEEP_STREAM_PREVIOUS_STATUS"
echo ""

# Stop services before installation to prevent conflicts
stop_services_for_installation
echo ""

echo "Branch: ${BRANCH}"
echo ""
echo "This script will check and update the following components:"
echo "  - Service management (stop services before installation, restore after)"
echo "  - Repository code (skipped if already present)"
echo "  - Bun runtime (skipped if already installed)"
echo "  - Node.js v22.18.0 (skipped if correct version installed)"
echo "  - Server dependencies (includes automatic frontend build)"
echo "  - SystemD service (updated, restored to previous state)"
echo "  - Data directories and migrations"
echo "  - Time synchronization (NTP configuration and periodic sync)"
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
  if fetch_github_commit_info "$BRANCH" 8; then
    REMOTE_COMMIT="$COMMIT_HASH"
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
  echo "Fetching latest commit information from GitHub..."
  if ! fetch_github_commit_info "$BRANCH" 10; then
    echo "Failed to fetch commit info from GitHub API (network/timeout), using fallback values"
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
  fix_bun_ownership "$USERNAME"

  # Run bun install anyway to update/verify dependencies, but with shorter timeout
  echo "Running bun install to verify/update dependencies..."
  run_as_user_with_timeout "$USERNAME" 60 "cd '$SERVER_DIR' && /home/$USERNAME/.bun/bin/bun install" || echo "Dependency check completed (may have been interrupted)"
else
  echo "Installing dependencies in $SERVER_DIR ..."

  # Fix potential permission issues with bun cache directory
  echo "Ensuring bun cache directory has correct ownership..."
  fix_bun_ownership "$USERNAME"

  if command -v timeout >/dev/null 2>&1; then
    echo "Running bun install with a 180s timeout to detect hangs..."
    if ! run_as_user_with_timeout "$USERNAME" 180 "cd '$SERVER_DIR' && /home/$USERNAME/.bun/bin/bun install"; then
      echo "bun install failed or timed out. Clearing cache and applying workarounds..."

      # Clear bun cache to resolve permission issues
      echo "Clearing bun cache..."
      sudo -u "$USERNAME" bash -c "/home/$USERNAME/.bun/bin/bun pm cache rm" || true

      # Apply IPv6 workarounds
      apply_ipv6_workarounds

      # Ensure ownership is correct again after cache clear
      fix_bun_ownership "$USERNAME"

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
    fix_bun_ownership "$USERNAME"
    sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.bun/bin/bun install"
  fi
fi

echo "Running Prisma migrations..."
# Ensure Bun is in PATH for nested spawns inside the npm script (dotenv -> bun x ...)
if sudo -u "$USERNAME" bash -lc "export BUN_INSTALL=/home/$USERNAME/.bun; export PATH=/home/$USERNAME/.bun/bin:$PATH; cd '$SERVER_DIR' && bun run migrate deploy"; then
  echo "Prisma migrations completed successfully."
else
  echo "WARNING: Prisma migrations failed or were interrupted. This may happen if the database needs to be reset."
  echo "The server will still start, but you may need to run migrations manually later."
  echo "To reset and migrate manually, run: cd '$SERVER_DIR' && bun run migrate:reset && bun run migrate deploy"
fi

# --------------------------------------------------------------------------------
# Create systemd service

SERVICE_FILE="/etc/systemd/system/free-sleep.service"

if systemctl is-enabled free-sleep.service >/dev/null 2>&1; then
  echo "Free Sleep service is already configured. Updating service file..."

  # Always update the service file in case there are changes
  echo "Updating systemd service file at $SERVICE_FILE..."

  # Build PATH with Volta support if detected
  SERVICE_PATH=$(build_service_path "$USERNAME" "$VOLTA_DETECTED")
  create_systemd_service "$SERVICE_FILE" "$USERNAME" "$SERVER_DIR" "$SERVICE_PATH"

  echo "Reloading systemd daemon..."
  systemctl daemon-reload
  echo "Service file updated. Service will be restored to previous state later."
else
  echo "Creating systemd service file at $SERVICE_FILE..."

  # Build PATH with Volta support if detected
  SERVICE_PATH=$(build_service_path "$USERNAME" "$VOLTA_DETECTED")
  create_systemd_service "$SERVICE_FILE" "$USERNAME" "$SERVER_DIR" "$SERVICE_PATH"

  echo "Reloading systemd daemon and enabling the service..."
  systemctl daemon-reload
  systemctl enable free-sleep.service
  echo "Service created and enabled. Will be started based on previous state."
fi

echo "Current service status after update:"
systemctl status free-sleep.service --no-pager || true

echo "Configuring system time synchronization..."

# Function to check if timesyncd is available
check_timesyncd() {
  systemctl list-unit-files | grep -q systemd-timesyncd
}

# Function to configure NTP servers
configure_ntp_servers() {
  echo "Configuring NTP servers..."

  # Backup existing config if it exists
  if [ -f /etc/systemd/timesyncd.conf ]; then
    cp /etc/systemd/timesyncd.conf "/etc/systemd/timesyncd.conf.backup.$(date +%Y%m%d_%H%M%S)" || true
  fi

  # Create new timesyncd configuration
  cat > /etc/systemd/timesyncd.conf <<EOF
[Time]
NTP=pool.ntp.org 0.pool.ntp.org 1.pool.ntp.org 2.pool.ntp.org 3.pool.ntp.org
FallbackNTP=time1.google.com time2.google.com time3.google.com time4.google.com
RootDistanceMaxSec=5
PollIntervalMinSec=32
PollIntervalMaxSec=2048
EOF

  echo "NTP servers configured successfully."
}

# Function to enable and start timesyncd
enable_time_sync() {
  echo "Enabling and starting systemd-timesyncd..."

  # Stop and disable conflicting services
  for service in ntp chrony; do
    if systemctl is-active "$service" >/dev/null 2>&1; then
      echo "Stopping conflicting time service: $service"
      systemctl stop "$service" || true
      systemctl disable "$service" || true
    fi
  done

  # Enable and start timesyncd
  systemctl enable systemd-timesyncd || true
  systemctl restart systemd-timesyncd || true

  # Wait a moment for the service to start
  sleep 2

  # Check if service is running
  if systemctl is-active systemd-timesyncd >/dev/null 2>&1; then
    echo "systemd-timesyncd is running successfully."

    # Show sync status
    timedatectl status | grep "System clock synchronized" || true
    timedatectl status | grep "NTP service" || true
  else
    echo "WARNING: systemd-timesyncd failed to start."
  fi
}

# Function to manually sync time if timesyncd is not available
manual_time_sync() {
  echo "Attempting manual time synchronization..."

  # Try multiple time sources
  TIME_SOURCES=(
    "http://google.com"
    "http://worldtimeapi.org/api/ip"
    "http://pool.ntp.org"
  )

  for source in "${TIME_SOURCES[@]}"; do
    echo "Trying to get time from $source..."

    if [[ "$source" == *"worldtimeapi"* ]]; then
      # WorldTimeAPI returns JSON with datetime field
      if command -v curl >/dev/null 2>&1; then
        datetime=$(curl -s --connect-timeout 10 --max-time 15 "$source" | grep -o '"datetime":"[^"]*"' | cut -d'"' -f4 | head -1)
        if [ -n "$datetime" ]; then
          # Convert ISO format to date command format
          date_string=$(echo "$datetime" | sed 's/T/ /' | sed 's/\.[0-9]*+.*//')
          if date -s "$date_string" >/dev/null 2>&1; then
            echo "Time synchronized successfully from $source"
            return 0
          fi
        fi
      fi
    else
      # HTTP date header method
      if command -v curl >/dev/null 2>&1; then
        date_string=$(curl -s --connect-timeout 10 --max-time 15 --head "$source" | grep '^Date: ' | sed 's/Date: //g' | tr -d '\r')
        if [ -n "$date_string" ] && date -s "$date_string" >/dev/null 2>&1; then
          echo "Time synchronized successfully from $source"
          return 0
        fi
      fi
    fi
  done

  echo "WARNING: Manual time synchronization failed from all sources."
  return 1
}

# Function to create time sync cron job for blocked internet scenarios
setup_periodic_time_sync() {
  echo "Setting up periodic time synchronization for blocked internet scenarios..."

  # Create a script that temporarily unblocks internet, syncs time, then blocks again
  # Ensure target bin directory exists
  mkdir -p /usr/local/bin

  cat > /usr/local/bin/sync-time-with-internet.sh <<'EOF'
#!/bin/bash
# Periodic time sync script for pods with blocked internet

# Set PATH to ensure all system binaries can be found when run from cron
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

SCRIPT_DIR="/home/dac/free-sleep/scripts"
LOG_FILE="/persistent/free-sleep-data/logs/time-sync.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log with timestamp
log_message() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

log_message "Starting periodic time sync"

# Check if internet is currently blocked by testing connectivity
if ! curl -s --connect-timeout 5 --max-time 10 http://google.com >/dev/null 2>&1; then
  log_message "Internet appears to be blocked, temporarily unblocking for time sync"

  # Unblock internet access
  if [ -f "$SCRIPT_DIR/unblock_internet_access.sh" ]; then
    bash "$SCRIPT_DIR/unblock_internet_access.sh" >> "$LOG_FILE" 2>&1
    sleep 3
  else
    log_message "ERROR: unblock_internet_access.sh not found"
    exit 1
  fi

  # Force time sync
  if systemctl is-active systemd-timesyncd >/dev/null 2>&1; then
    systemctl restart systemd-timesyncd
    sleep 10
    timedatectl set-ntp true
    sleep 5
  fi

  # Check if sync was successful
  if timedatectl status | grep -q "System clock synchronized: yes"; then
    log_message "Time synchronization successful"
  else
    log_message "Time synchronization may have failed"
  fi

  # Re-block internet access
  if [ -f "$SCRIPT_DIR/block_internet_access.sh" ]; then
    bash "$SCRIPT_DIR/block_internet_access.sh" >> "$LOG_FILE" 2>&1
    log_message "Internet access re-blocked"
  else
    log_message "ERROR: block_internet_access.sh not found"
  fi
else
  log_message "Internet is accessible, performing standard time sync"

  if systemctl is-active systemd-timesyncd >/dev/null 2>&1; then
    systemctl restart systemd-timesyncd
    sleep 5
  fi
fi

log_message "Periodic time sync completed"
EOF

  chmod +x /usr/local/bin/sync-time-with-internet.sh
  chown root:root /usr/local/bin/sync-time-with-internet.sh

  # Add cron job to run twice daily (6 AM and 6 PM)
  CRON_JOB="0 6,18 * * * /usr/local/bin/sync-time-with-internet.sh"

  # Check if cron job already exists
  if ! crontab -l 2>/dev/null | grep -q "sync-time-with-internet.sh"; then
    # Get current crontab
    CURRENT_CRONTAB=$(crontab -l 2>/dev/null || true)

    # Add PATH environment variable if not already present
    if ! echo "$CURRENT_CRONTAB" | grep -q "^PATH="; then
      CURRENT_CRONTAB="$CURRENT_CRONTAB"$'\n'"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    fi

    # Add the cron job
    echo "$CURRENT_CRONTAB"$'\n'"$CRON_JOB" | crontab -
    echo "Periodic time sync cron job added (runs at 6 AM and 6 PM daily)."
  else
    echo "Periodic time sync cron job already exists."
  fi
}

# Main time synchronization logic
if check_timesyncd; then
  echo "systemd-timesyncd is available on this system."

  # Configure NTP servers
  configure_ntp_servers

  # Enable time synchronization
  enable_time_sync

  # Try to sync immediately if we have internet
  if curl -s --connect-timeout 5 --max-time 10 http://google.com >/dev/null 2>&1; then
    echo "Internet connectivity detected, forcing immediate time sync..."
    timedatectl set-ntp true
    sleep 5

    # Show current sync status
    echo "Current time sync status:"
    timedatectl status | grep -E "(Local time|Universal time|System clock synchronized|NTP service)" || true
  else
    echo "No internet connectivity detected during installation."
    manual_time_sync || true
  fi

else
  echo "systemd-timesyncd not available, attempting manual time sync..."
  manual_time_sync || true
fi

# Always setup periodic sync for blocked internet scenarios
setup_periodic_time_sync

echo "Time synchronization configuration completed."

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

# --------------------------------------------------------------------------------
# Add user to systemd-journal group for log access

echo "Adding '$USERNAME' to systemd-journal group for capwater sensor log access..."
if groups "$USERNAME" | grep -q "\bsystemd-journal\b"; then
  echo "User '$USERNAME' is already in systemd-journal group."
else
  sudo usermod -a -G systemd-journal "$USERNAME"
  echo "User '$USERNAME' added to systemd-journal group successfully."
fi

echo ""

# --------------------------------------------------------------------------------
# Restore services to their previous state

start_services_after_installation

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
echo "Time synchronization status:"
if systemctl is-active systemd-timesyncd >/dev/null 2>&1; then
  echo -e "  - systemd-timesyncd: \033[0;32mActive\033[0m"
  timedatectl status | grep -E "(System clock synchronized|NTP service)" | sed 's/^/    /' || true
else
  echo -e "  - systemd-timesyncd: \033[0;33mInactive\033[0m"
fi
echo "  - Periodic sync: Configured (runs at 6 AM and 6 PM daily)"
echo "  - Time sync logs: /persistent/free-sleep-data/logs/time-sync.log"

echo ""
echo -e "\033[0;32mInstallation complete! The Free Sleep server is running and will start automatically on boot.\033[0m"
echo -e "\033[0;32mSee logs with: journalctl -u free-sleep --no-pager --output=cat\033[0m"
echo -e "\033[0;32mTime sync logs: tail -f /persistent/free-sleep-data/logs/time-sync.log\033[0m"
echo ""
echo "To re-run this script safely:"
echo "  ./install.sh                    # Install/switch to main branch"
echo "  BRANCH=beta ./install.sh        # Install/switch to beta branch"
echo "  FORCE_UPDATE=true ./install.sh  # Force repository update"
echo ""
echo "To manually sync time now: /usr/local/bin/sync-time-with-internet.sh"
echo "==================================================================="
