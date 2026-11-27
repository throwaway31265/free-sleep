#!/bin/sh
# -----------------------------------------------------------------------------
# autopilot_snapshot.sh - save the installed free-sleep build so Autopilot can
# be rolled back with scripts/autopilot_rollback.sh --full.
#
# Usage:
#   sudo sh /home/dac/free-sleep/scripts/autopilot_snapshot.sh [--force] [--dry-run]
#
#   --force    take a snapshot even when the newest one has identical code
#   --dry-run  print what would happen without writing anything
#   -h|--help  show this help
#
# What it saves (paths that do not exist are skipped):
#   /home/dac/free-sleep/server/dist            compiled server
#   /home/dac/free-sleep/server/public          compiled app (vite outDir)
#   /home/dac/free-sleep/biometrics/environment environment reader
#   /persistent/free-sleep-data/lowdb/settingsDB.json   (reference copy only)
#   /persistent/free-sleep-data/lowdb/schedulesDB.json  (reference copy only)
#
# Output: /persistent/free-sleep-rollback/<sha>-<timestamp>.tgz, a <name>.meta
# file next to it (sha, version, autopilot=yes|no, code fingerprint) and
# LAST_GOOD (path=..., sha=..., pre_autopilot_sha=...) pointing at the newest
# snapshot and remembering the newest build without Autopilot.
# Run this by hand on the pre-Autopilot build BEFORE deploying Autopilot.
# Keeps the newest 3 snapshots, plus the newest one without Autopilot so a
# --full rollback always has a pre-Autopilot build to go back to.
#
# Called by scripts/update.sh before a new build is installed. Safe to run by
# hand at any time; it only reads the install and writes under the rollback
# folder. Aborts when /persistent has less than 50 MB free.
# Logs to /persistent/free-sleep-data/logs/autopilot-rollback.log.
#
# Overrides for testing: FREE_SLEEP_APP_DIR, FREE_SLEEP_DATA_DIR,
# AUTOPILOT_ROLLBACK_DIR (all absolute paths).
# -----------------------------------------------------------------------------
set -u

APP_DIR="${FREE_SLEEP_APP_DIR:-/home/dac/free-sleep}"
DATA_DIR="${FREE_SLEEP_DATA_DIR:-/persistent/free-sleep-data}"
ROLLBACK_DIR="${AUTOPILOT_ROLLBACK_DIR:-/persistent/free-sleep-rollback}"
LOG_FILE="$DATA_DIR/logs/autopilot-rollback.log"
KEEP_COUNT=3
MIN_FREE_KB=51200

DRY_RUN=0
FORCE=0

usage() {
  sed -n '3,/^# ------/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --force) FORCE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

# Re-exec as root. A dry run may continue unprivileged when sudo is missing.
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    exec sudo env FREE_SLEEP_APP_DIR="$APP_DIR" FREE_SLEEP_DATA_DIR="$DATA_DIR" \
      AUTOPILOT_ROLLBACK_DIR="$ROLLBACK_DIR" sh "$0" "$@"
  elif [ "$DRY_RUN" -ne 1 ]; then
    echo "autopilot_snapshot.sh must run as root." >&2
    exit 1
  fi
fi

log() {
  line="$(date '+%Y-%m-%d %H:%M:%S') [snapshot] $*"
  echo "$line"
  if [ "$DRY_RUN" -ne 1 ]; then
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null
    echo "$line" >> "$LOG_FILE" 2>/dev/null || true
  fi
}

die() {
  log "ERROR: $*"
  exit 1
}

# Run a command, or only print it in dry-run mode.
run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[dry-run] $*"
    return 0
  fi
  "$@"
}

# Print the free KB on the filesystem that holds $1 (or its nearest parent).
free_kb_for() {
  probe="$1"
  while [ ! -d "$probe" ] && [ "$probe" != "/" ]; do
    probe="$(dirname "$probe")"
  done
  df -Pk "$probe" 2>/dev/null | awk 'NR==2 {print $4}'
}

# Short git sha of the install, else the serverInfo.json version, else "unknown".
detect_sha() {
  sha="$(git -C "$APP_DIR" rev-parse --short=12 HEAD 2>/dev/null || true)"
  if [ -z "$sha" ] && [ -f "$APP_DIR/server/src/serverInfo.json" ]; then
    sha="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/v\1/p' \
      "$APP_DIR/server/src/serverInfo.json" | head -n 1)"
  fi
  [ -n "$sha" ] || sha="unknown"
  # Keep the value safe for a file name.
  echo "$sha" | tr -c 'A-Za-z0-9._\n-' '_'
}

# Checksum of every code file in the snapshot, used to skip duplicate snapshots.
# Prints "none" when no checksum tool exists, which disables the skip.
code_fingerprint() {
  hash_tool=""
  for hash_candidate in sha256sum md5sum cksum; do
    if command -v "$hash_candidate" >/dev/null 2>&1; then
      hash_tool="$hash_candidate"
      break
    fi
  done
  if [ -z "$hash_tool" ]; then
    echo "none"
    return 0
  fi
  for code_dir in server/dist server/public biometrics/environment; do
    if [ -d "$APP_DIR/$code_dir" ]; then
      (cd "$APP_DIR" && find "$code_dir" -type f | LC_ALL=C sort | while IFS= read -r code_file; do
        "$hash_tool" "$code_file"
      done)
    fi
  done | "$hash_tool" | awk '{print $1}'
}

# Read key=value from a meta file.
meta_value() {
  sed -n "s/^$2=//p" "$1" 2>/dev/null | head -n 1
}

# Delete old snapshots: keep the newest KEEP_COUNT plus the newest pre-Autopilot one.
prune_snapshots() {
  keep_plain=""
  for snapshot_file in $(ls -1t "$ROLLBACK_DIR"/*.tgz 2>/dev/null); do
    if [ "$(meta_value "${snapshot_file%.tgz}.meta" autopilot)" = "no" ]; then
      keep_plain="$snapshot_file"
      break
    fi
  done
  index=0
  for snapshot_file in $(ls -1t "$ROLLBACK_DIR"/*.tgz 2>/dev/null); do
    index=$((index + 1))
    if [ "$index" -le "$KEEP_COUNT" ] || [ "$snapshot_file" = "$keep_plain" ]; then
      continue
    fi
    log "Pruning old snapshot $snapshot_file"
    run rm -f "$snapshot_file" "${snapshot_file%.tgz}.meta"
  done
}

case "$APP_DIR$DATA_DIR$ROLLBACK_DIR" in
  *" "*) die "Paths with spaces are not supported." ;;
esac
case "$APP_DIR" in /*) ;; *) die "FREE_SLEEP_APP_DIR must be absolute." ;; esac
case "$DATA_DIR" in /*) ;; *) die "FREE_SLEEP_DATA_DIR must be absolute." ;; esac

free_kb="$(free_kb_for "$ROLLBACK_DIR")"
case "$free_kb" in
  ''|*[!0-9]*) die "Could not read free space for $ROLLBACK_DIR." ;;
esac
if [ "$free_kb" -lt "$MIN_FREE_KB" ]; then
  die "Only ${free_kb} KB free for $ROLLBACK_DIR (need ${MIN_FREE_KB} KB). Snapshot skipped."
fi

# Collect existing paths relative to / so one tar -C / covers code and data.
members=""
for candidate in \
  "$APP_DIR/server/dist" \
  "$APP_DIR/server/public" \
  "$APP_DIR/biometrics/environment" \
  "$DATA_DIR/lowdb/settingsDB.json" \
  "$DATA_DIR/lowdb/schedulesDB.json"; do
  if [ -e "$candidate" ]; then
    members="$members ${candidate#/}"
  fi
done
if [ ! -d "$APP_DIR/server/dist" ] && [ ! -d "$APP_DIR/server/public" ]; then
  die "No server/dist or server/public under $APP_DIR; nothing to snapshot."
fi

sha="$(detect_sha)"
timestamp="$(date '+%Y%m%d-%H%M%S')"
fingerprint="$(code_fingerprint)"
if [ -f "$APP_DIR/server/dist/jobs/autopilotScheduler.js" ]; then
  has_autopilot="yes"
else
  has_autopilot="no"
fi

# Idempotency: identical code to the newest snapshot means nothing to do.
newest="$(ls -1t "$ROLLBACK_DIR"/*.tgz 2>/dev/null | head -n 1)"
if [ "$FORCE" -ne 1 ] && [ -n "$newest" ] && [ "$fingerprint" != "none" ] \
  && [ "$(meta_value "${newest%.tgz}.meta" fingerprint)" = "$fingerprint" ]; then
  log "Code matches newest snapshot $newest; skipping (use --force to snapshot anyway)."
  exit 0
fi

snapshot_path="$ROLLBACK_DIR/$sha-$timestamp.tgz"
log "Creating $snapshot_path (sha=$sha autopilot=$has_autopilot)"
log "Members:$members"

run mkdir -p "$ROLLBACK_DIR"
# shellcheck disable=SC2086 # members is a space-separated list without spaces in paths
if ! run tar -czf "$snapshot_path.partial" -C / $members; then
  run rm -f "$snapshot_path.partial"
  die "tar failed; snapshot not saved."
fi
run mv "$snapshot_path.partial" "$snapshot_path" || die "Could not move snapshot into place."

if [ "$DRY_RUN" -eq 1 ]; then
  echo "[dry-run] write ${snapshot_path%.tgz}.meta and $ROLLBACK_DIR/LAST_GOOD"
else
  version="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    "$APP_DIR/server/src/serverInfo.json" 2>/dev/null | head -n 1)"
  {
    echo "sha=$sha"
    echo "version=$version"
    echo "created=$timestamp"
    echo "autopilot=$has_autopilot"
    echo "fingerprint=$fingerprint"
    echo "app_dir=$APP_DIR"
  } > "${snapshot_path%.tgz}.meta"
  # Remember the newest pre-Autopilot sha separately, so --full can rebuild from it even
  # after later snapshots of Autopilot builds have replaced path/sha.
  if [ "$has_autopilot" = "no" ]; then
    pre_autopilot_sha="$sha"
  else
    pre_autopilot_sha="$(meta_value "$ROLLBACK_DIR/LAST_GOOD" pre_autopilot_sha)"
  fi
  {
    echo "path=$snapshot_path"
    echo "sha=$sha"
    [ -z "$pre_autopilot_sha" ] || echo "pre_autopilot_sha=$pre_autopilot_sha"
  } > "$ROLLBACK_DIR/LAST_GOOD.tmp" && mv "$ROLLBACK_DIR/LAST_GOOD.tmp" "$ROLLBACK_DIR/LAST_GOOD"
  if [ "$has_autopilot" = "yes" ] && [ -z "$pre_autopilot_sha" ]; then
    log "WARNING: no pre-Autopilot build has been snapshotted; autopilot_rollback.sh --full may have nothing to restore."
  fi
fi

prune_snapshots
log "Snapshot complete: $snapshot_path"
exit 0
