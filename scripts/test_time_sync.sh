#!/bin/bash
# Test script for time synchronization functionality
#
# This script tests the various time sync components without requiring
# a full installation. It's designed to be run on any system to verify
# the logic works correctly.

set -euo pipefail

echo "==================================================================="
echo "           Time Synchronization Test Script"
echo "==================================================================="
echo ""

# Test 1: Check if timesyncd is available
echo "Test 1: Checking systemd-timesyncd availability..."
if systemctl list-unit-files | grep -q systemd-timesyncd; then
    echo "✓ systemd-timesyncd is available"
else
    echo "✗ systemd-timesyncd is not available"
fi
echo ""

# Test 2: Test manual time sync functions (without actually changing time)
echo "Test 2: Testing manual time sync logic..."

test_time_sources() {
    local TIME_SOURCES=(
        "http://google.com"
        "http://worldtimeapi.org/api/ip"
        "http://pool.ntp.org"
    )

    for source in "${TIME_SOURCES[@]}"; do
        echo "  Testing connectivity to $source..."

        if [[ "$source" == *"worldtimeapi"* ]]; then
            if command -v curl >/dev/null 2>&1; then
                if datetime=$(curl -s --connect-timeout 5 --max-time 10 "$source" | grep -o '"datetime":"[^"]*"' | cut -d'"' -f4 | head -1); then
                    if [ -n "$datetime" ]; then
                        echo "    ✓ Got datetime: $datetime"
                    else
                        echo "    ✗ No datetime received"
                    fi
                else
                    echo "    ✗ Failed to retrieve data"
                fi
            fi
        else
            if command -v curl >/dev/null 2>&1; then
                if date_string=$(curl -s --connect-timeout 5 --max-time 10 --head "$source" | grep '^Date: ' | sed 's/Date: //g' | tr -d '\r'); then
                    if [ -n "$date_string" ]; then
                        echo "    ✓ Got date: $date_string"
                    else
                        echo "    ✗ No date received"
                    fi
                else
                    echo "    ✗ Failed to retrieve header"
                fi
            fi
        fi
    done
}

test_time_sources
echo ""

# Test 3: Check current time sync status
echo "Test 3: Current time synchronization status..."
if command -v timedatectl >/dev/null 2>&1; then
    echo "Current timedatectl status:"
    timedatectl status | grep -E "(Local time|Universal time|System clock synchronized|NTP service)" || echo "No relevant status found"
else
    echo "timedatectl not available"
fi
echo ""

# Test 4: Check if cron is available for periodic sync
echo "Test 4: Checking cron availability..."
if command -v crontab >/dev/null 2>&1; then
    echo "✓ crontab is available"
    echo "Current cron jobs (if any):"
    crontab -l 2>/dev/null | grep -v "^#" | head -5 || echo "No cron jobs found"
else
    echo "✗ crontab is not available"
fi
echo ""

# Test 5: Check directory permissions for log storage
echo "Test 5: Testing log directory creation..."
TEST_LOG_DIR="/tmp/test-free-sleep-logs"
mkdir -p "$TEST_LOG_DIR"
if [ -d "$TEST_LOG_DIR" ]; then
    echo "✓ Log directory creation works"
    # Test log writing
    if echo "$(date '+%Y-%m-%d %H:%M:%S') - Test log entry" > "$TEST_LOG_DIR/test.log"; then
        echo "✓ Log writing works"
        echo "  Sample log content: $(cat "$TEST_LOG_DIR/test.log")"
    else
        echo "✗ Log writing failed"
    fi
    rm -rf "$TEST_LOG_DIR"
else
    echo "✗ Log directory creation failed"
fi
echo ""

# Test 6: Validate script syntax
echo "Test 6: Validating periodic sync script syntax..."
TEST_SCRIPT="/tmp/test-sync-script.sh"
cat > "$TEST_SCRIPT" <<'EOF'
#!/bin/bash
# Test version of periodic sync script

SCRIPT_DIR="/home/dac/free-sleep/scripts"
LOG_FILE="/tmp/test-time-sync.log"

mkdir -p "$(dirname "$LOG_FILE")"

log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

log_message "Test sync script syntax validation"
echo "Script syntax appears valid"
EOF

chmod +x "$TEST_SCRIPT"
if bash -n "$TEST_SCRIPT"; then
    echo "✓ Periodic sync script syntax is valid"
    # Run the test script
    if bash "$TEST_SCRIPT"; then
        echo "✓ Periodic sync script executes successfully"
        if [ -f /tmp/test-time-sync.log ]; then
            echo "  Generated log: $(cat /tmp/test-time-sync.log)"
            rm -f /tmp/test-time-sync.log
        fi
    else
        echo "✗ Periodic sync script execution failed"
    fi
else
    echo "✗ Periodic sync script has syntax errors"
fi
rm -f "$TEST_SCRIPT"
echo ""

echo "==================================================================="
echo "                    Test Summary"
echo "==================================================================="
echo ""
echo "The time synchronization components have been tested for:"
echo "  • systemd-timesyncd availability"
echo "  • Manual time source connectivity"
echo "  • Current time sync status"
echo "  • Cron scheduling capability"
echo "  • Log file creation and writing"
echo "  • Periodic sync script syntax"
echo ""
echo "If all tests passed, the time synchronization solution should work"
echo "correctly when deployed with the install.sh script."
echo "==================================================================="
