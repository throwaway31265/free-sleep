#!/bin/bash
# Eight Sleep Water Level Monitor
# Monitors capwater sensor for leak detection and low water warnings

set -euo pipefail

# Configuration
readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_DIR="/tmp/eight-sleep-water-monitor"
readonly WATER_LOG="$LOG_DIR/water_levels.log"
readonly STATE_FILE="$LOG_DIR/water_state.json"
readonly ALERT_FILE="$LOG_DIR/alerts.log"

# Water level thresholds
readonly LEAK_THRESHOLD=0.05  # Change indicating possible leak (5% range drop)
readonly LOW_WATER_THRESHOLD=0.20  # Low water warning (20% from empty)
readonly CRITICAL_THRESHOLD=0.10   # Critical low water (10% from empty)
readonly MONITORING_INTERVAL=300   # 5 minutes default

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$WATER_LOG"
}

info() { log "INFO" "$@"; }
warn() { log "WARN" "$@"; }
error() { log "ERROR" "$@"; }
alert() { 
    log "ALERT" "$@"
    echo "[$timestamp] ALERT: $*" >> "$ALERT_FILE"
}

# Setup
setup() {
    mkdir -p "$LOG_DIR"
    touch "$WATER_LOG" "$ALERT_FILE"
}

# Parse capwater reading from journalctl
get_latest_capwater() {
    local raw_line
    raw_line=$(journalctl --no-pager --lines=1000 | grep -E '\[capwater\] Raw:' | tail -1 2>/dev/null || echo "")
    
    if [[ -z "$raw_line" ]]; then
        echo "ERROR: No capwater readings found"
        return 1
    fi
    
    # Parse: [capwater] Raw: 1.141350, Capwater calibrated. Empty: 0.84, Full: 1.13
    local raw_value empty_cal full_cal
    if [[ $raw_line =~ Raw:[[:space:]]*([0-9.]+).*Empty:[[:space:]]*([0-9.]+).*Full:[[:space:]]*([0-9.]+) ]]; then
        raw_value="${BASH_REMATCH[1]}"
        empty_cal="${BASH_REMATCH[2]}"
        full_cal="${BASH_REMATCH[3]}"
    else
        echo "ERROR: Could not parse capwater reading"
        return 1
    fi
    
    # Calculate percentage (0-100%)
    local range=$(bc <<< "scale=6; $full_cal - $empty_cal")
    local level_above_empty=$(bc <<< "scale=6; $raw_value - $empty_cal")
    local percentage=$(bc <<< "scale=2; ($level_above_empty / $range) * 100")
    
    # Handle negative percentages (below calibrated empty)
    if (( $(bc <<< "$percentage < 0") )); then
        percentage="0.00"
    elif (( $(bc <<< "$percentage > 100") )); then
        percentage="100.00"
    fi
    
    echo "{\"timestamp\":\"$(date -Iseconds)\",\"raw\":$raw_value,\"empty_cal\":$empty_cal,\"full_cal\":$full_cal,\"percentage\":$percentage,\"range\":$range}"
}

# Save reading to state file
save_reading() {
    local reading="$1"
    echo "$reading" > "$STATE_FILE"
    
    # Also append to historical log
    echo "$reading" >> "$LOG_DIR/historical_readings.jsonl"
}

# Get previous reading
get_previous_reading() {
    if [[ -f "$STATE_FILE" ]]; then
        cat "$STATE_FILE"
    else
        echo "{\"percentage\":0}"
    fi
}

# Check for leaks (rapid drop in water level)
check_for_leak() {
    local current_pct="$1"
    local previous_pct="$2"
    local time_diff="$3"  # minutes
    
    local drop=$(bc <<< "scale=2; $previous_pct - $current_pct")
    local drop_rate=$(bc <<< "scale=4; $drop / $time_diff")  # % per minute
    
    # Convert threshold to per-minute rate (assume 1 hour = significant leak)
    local leak_rate=$(bc <<< "scale=4; $LEAK_THRESHOLD * 100 / 60")  # 5% per hour = ~0.083% per minute
    
    if (( $(bc <<< "$drop > 5") )) && (( $(bc <<< "$drop_rate > $leak_rate") )); then
        alert "POSSIBLE LEAK DETECTED: Water level dropped ${drop}% in ${time_diff} minutes (rate: ${drop_rate}%/min)"
        return 0
    fi
    
    return 1
}

# Check water level warnings
check_water_levels() {
    local percentage="$1"
    local raw_value="$2"
    
    if (( $(bc <<< "$percentage < ($CRITICAL_THRESHOLD * 100)") )); then
        alert "CRITICAL: Water level critically low at ${percentage}% (raw: $raw_value)"
        return 2
    elif (( $(bc <<< "$percentage < ($LOW_WATER_THRESHOLD * 100)") )); then
        alert "WARNING: Water level low at ${percentage}% (raw: $raw_value)"
        return 1
    fi
    
    return 0
}

# Single reading check
check_water() {
    local current_reading
    current_reading=$(get_latest_capwater) || {
        error "Failed to get capwater reading"
        return 1
    }
    
    local current_pct raw_value
    current_pct=$(echo "$current_reading" | grep -o '"percentage":[0-9.]*' | cut -d: -f2)
    raw_value=$(echo "$current_reading" | grep -o '"raw":[0-9.]*' | cut -d: -f2)
    
    info "Current water level: ${current_pct}% (raw: $raw_value)"
    
    # Save current reading
    save_reading "$current_reading"
    
    # Check water level warnings
    check_water_levels "$current_pct" "$raw_value"
    
    # Check for leaks (if we have previous data)
    if [[ -f "$STATE_FILE" ]]; then
        local previous_reading previous_pct previous_time current_time time_diff_sec time_diff_min
        previous_reading=$(get_previous_reading)
        previous_pct=$(echo "$previous_reading" | grep -o '"percentage":[0-9.]*' | cut -d: -f2 2>/dev/null || echo "0")
        
        if [[ -n "$previous_pct" && "$previous_pct" != "0" ]]; then
            previous_time=$(echo "$previous_reading" | grep -o '"timestamp":"[^"]*' | cut -d\" -f4 2>/dev/null || echo "")
            current_time=$(echo "$current_reading" | grep -o '"timestamp":"[^"]*' | cut -d\" -f4)
            
            if [[ -n "$previous_time" ]]; then
                time_diff_sec=$(( $(date -d "$current_time" +%s) - $(date -d "$previous_time" +%s) ))
                time_diff_min=$(bc <<< "scale=1; $time_diff_sec / 60")
                
                if (( $(bc <<< "$time_diff_min > 1") )); then
                    check_for_leak "$current_pct" "$previous_pct" "$time_diff_min"
                fi
            fi
        fi
    fi
}

# Continuous monitoring mode
monitor() {
    local interval="${1:-$MONITORING_INTERVAL}"
    
    info "Starting water level monitoring (interval: ${interval}s)"
    
    while true; do
        check_water
        
        echo -e "${BLUE}Water Level Status:${NC}"
        local latest_reading
        latest_reading=$(cat "$STATE_FILE" 2>/dev/null || echo "{}")
        local pct raw
        pct=$(echo "$latest_reading" | grep -o '"percentage":[0-9.]*' | cut -d: -f2 2>/dev/null || echo "0")
        raw=$(echo "$latest_reading" | grep -o '"raw":[0-9.]*' | cut -d: -f2 2>/dev/null || echo "0")
        
        if (( $(bc <<< "$pct < 10") )); then
            echo -e "  ${RED}Critical: ${pct}%${NC} (raw: $raw)"
        elif (( $(bc <<< "$pct < 20") )); then
            echo -e "  ${YELLOW}Low: ${pct}%${NC} (raw: $raw)"
        else
            echo -e "  ${GREEN}Normal: ${pct}%${NC} (raw: $raw)"
        fi
        
        sleep "$interval"
    done
}

# Show historical data
show_history() {
    local hours="${1:-24}"
    
    if [[ ! -f "$LOG_DIR/historical_readings.jsonl" ]]; then
        echo "No historical data available"
        return
    fi
    
    echo -e "${BLUE}Water Level History (last $hours hours):${NC}"
    echo "Timestamp                 | Raw Value | Percentage | Status"
    echo "---------------------------------------------------------"
    
    local cutoff_time
    cutoff_time=$(date -d "$hours hours ago" -Iseconds)
    
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            local timestamp pct raw status
            timestamp=$(echo "$line" | grep -o '"timestamp":"[^"]*' | cut -d\" -f4 2>/dev/null || echo "")
            pct=$(echo "$line" | grep -o '"percentage":[0-9.]*' | cut -d: -f2 2>/dev/null || echo "0")
            raw=$(echo "$line" | grep -o '"raw":[0-9.]*' | cut -d: -f2 2>/dev/null || echo "0")
            
            if [[ -n "$timestamp" ]] && [[ "$timestamp" > "$cutoff_time" ]]; then
                if (( $(bc <<< "$pct < 10") )); then
                    status="${RED}CRITICAL${NC}"
                elif (( $(bc <<< "$pct < 20") )); then
                    status="${YELLOW}LOW${NC}"
                else
                    status="${GREEN}NORMAL${NC}"
                fi
                
                printf "%-25s | %-9s | %-10s | %s\n" \
                    "$(date -d "$timestamp" '+%m-%d %H:%M:%S')" \
                    "$raw" \
                    "${pct}%" \
                    "$status"
            fi
        fi
    done < "$LOG_DIR/historical_readings.jsonl"
}

# Show current calibration
show_calibration() {
    local reading
    reading=$(get_latest_capwater) || {
        error "Failed to get capwater reading"
        return 1
    }
    
    local raw empty_cal full_cal range pct
    raw=$(echo "$reading" | grep -o '"raw":[0-9.]*' | cut -d: -f2)
    empty_cal=$(echo "$reading" | grep -o '"empty_cal":[0-9.]*' | cut -d: -f2)
    full_cal=$(echo "$reading" | grep -o '"full_cal":[0-9.]*' | cut -d: -f2)
    range=$(echo "$reading" | grep -o '"range":[0-9.]*' | cut -d: -f2)
    pct=$(echo "$reading" | grep -o '"percentage":[0-9.]*' | cut -d: -f2)
    
    echo -e "${BLUE}Capwater Sensor Calibration:${NC}"
    echo "  Raw Value:    $raw"
    echo "  Empty Cal:    $empty_cal"
    echo "  Full Cal:     $full_cal"
    echo "  Range:        $range"
    echo "  Percentage:   ${pct}%"
    
    if (( $(bc <<< "$raw < $empty_cal") )); then
        echo -e "  ${YELLOW}WARNING: Raw value below empty calibration${NC}"
    elif (( $(bc <<< "$raw > $full_cal") )); then
        echo -e "  ${YELLOW}WARNING: Raw value above full calibration${NC}"
    fi
}

# Usage
usage() {
    cat << EOF
${BLUE}Eight Sleep Water Level Monitor${NC}

${GREEN}Usage:${NC}
  $SCRIPT_NAME [COMMAND] [OPTIONS]

${GREEN}Commands:${NC}
  check                     - Single water level check
  monitor [interval]        - Continuous monitoring (default: ${MONITORING_INTERVAL}s)
  history [hours]           - Show historical data (default: 24h)
  calibration              - Show current sensor calibration
  alerts                   - Show recent alerts

${GREEN}Examples:${NC}
  $SCRIPT_NAME check                    # Single check
  $SCRIPT_NAME monitor 60               # Monitor every 60 seconds  
  $SCRIPT_NAME history 12               # Show last 12 hours
  $SCRIPT_NAME calibration              # Show sensor calibration

${YELLOW}Leak Detection:${NC}
  - Monitors for rapid water level drops
  - Alerts on suspicious drainage patterns
  - Logs all readings for trend analysis

${YELLOW}Files:${NC}
  - Logs: $WATER_LOG
  - State: $STATE_FILE  
  - Alerts: $ALERT_FILE
EOF
}

# Main function
main() {
    setup
    
    # Check if bc is available
    if ! command -v bc >/dev/null 2>&1; then
        error "bc calculator not found. Please install: apt-get install bc"
        exit 1
    fi
    
    case "${1:-}" in
        "check")
            check_water
            ;;
        "monitor")
            monitor "${2:-}"
            ;;
        "history")
            show_history "${2:-}"
            ;;
        "calibration")
            show_calibration
            ;;
        "alerts")
            if [[ -f "$ALERT_FILE" ]]; then
                echo -e "${BLUE}Recent Alerts:${NC}"
                tail -20 "$ALERT_FILE"
            else
                echo "No alerts recorded"
            fi
            ;;
        "help"|"-h"|"--help"|"")
            usage
            ;;
        *)
            error "Unknown command: $1"
            usage
            exit 1
            ;;
    esac
}

main "$@"