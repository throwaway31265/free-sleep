#!/bin/sh
# -----------------------------------------------------------------------------
# autopilot_rollback.sh - turn Autopilot off, or remove it completely.
#
# Usage:
#   sudo sh /home/dac/free-sleep/scripts/autopilot_rollback.sh [--soft|--full|--status] [--purge] [--dry-run]
#
#   --soft     (default, ~10 s, no restart) disable Autopilot on both sides via
#              the API, put each bed back on its anchor temperature if the
#              server did not, and stop free-sleep-environment.service.
#              If the API is down, edits settingsDB.json and restarts free-sleep.
#   --full     (~1 min) --soft, then stop free-sleep, restore server/dist and
#              server/public from the newest pre-Autopilot snapshot (or the
#              LAST_GOOD git sha), strip the "autopilot" key from settingsDB.json
#              (backup kept as settingsDB.json.pre-rollback-<ts>), remove the
#              environment unit and start free-sleep again. Snapshots that
#              already contain Autopilot are never used; with no pre-Autopilot
#              snapshot or git sha it aborts (server left running). It reports
#              FAIL if /api/autopilot still answers after the restore. Free-sleep
#              is restarted even if the script is interrupted while it is stopped.
#
# BEFORE deploying Autopilot (hot-patch or update), run autopilot_snapshot.sh by
# hand on the pre-Autopilot build; otherwise --full has nothing to go back to.
#   --status   per-side enabled/mode/state, environment service state, snapshot
#              age and the last 10 decisions. Changes nothing.
#   --purge    with --full: also delete /persistent/free-sleep-data/autopilot/
#   --dry-run  print every action without doing it
#   -h|--help  show this help
#
# Re-enable later (one line, while the Autopilot build is installed):
#   curl -fsS -X POST -H 'Content-Type: application/json' -d '{"left":{"autopilot":{"enabled":true}},"right":{"autopilot":{"enabled":true}}}' http://127.0.0.1:3000/api/settings && systemctl enable --now free-sleep-environment
#
# Safety: never sends isOn and never touches power, priming, alarms, schedules,
# frank, NATS or free-sleep-stream. The only device write is a backstop
# targetTemperatureF = anchorF for a side still sitting on Autopilot's value.
# Idempotent: running it again is harmless. Exit code 0 = PASS, 1 = FAIL,
# 2 = bad arguments. Log: /persistent/free-sleep-data/logs/autopilot-rollback.log
#
# Overrides for testing: FREE_SLEEP_APP_DIR, FREE_SLEEP_DATA_DIR,
# AUTOPILOT_ROLLBACK_DIR, FREE_SLEEP_API (default http://127.0.0.1:3000).
# -----------------------------------------------------------------------------
set -u

APP_DIR="${FREE_SLEEP_APP_DIR:-/home/dac/free-sleep}"
DATA_DIR="${FREE_SLEEP_DATA_DIR:-/persistent/free-sleep-data}"
ROLLBACK_DIR="${AUTOPILOT_ROLLBACK_DIR:-/persistent/free-sleep-rollback}"
API="${FREE_SLEEP_API:-http://127.0.0.1:3000}"
LOG_FILE="$DATA_DIR/logs/autopilot-rollback.log"
SETTINGS_FILE="$DATA_DIR/lowdb/settingsDB.json"
AUTOPILOT_STATE_DIR="$DATA_DIR/autopilot"
ENV_UNIT="free-sleep-environment.service"
ENV_UNIT_FILE="/etc/systemd/system/$ENV_UNIT"
SERVICE_USER="dac"
VOLTA_BIN="/home/$SERVICE_USER/.volta/bin"

MODE="soft"
PURGE=0
DRY_RUN=0

usage() {
  sed -n '3,/^# ------/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
  case "$arg" in
    --soft) MODE="soft" ;;
    --full) MODE="full" ;;
    --status) MODE="status" ;;
    --purge) PURGE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done
if [ "$PURGE" -eq 1 ] && [ "$MODE" != "full" ]; then
  echo "--purge only applies to --full." >&2
  exit 2
fi

# Re-exec as root. --status and --dry-run may continue unprivileged without sudo.
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    exec sudo env FREE_SLEEP_APP_DIR="$APP_DIR" FREE_SLEEP_DATA_DIR="$DATA_DIR" \
      AUTOPILOT_ROLLBACK_DIR="$ROLLBACK_DIR" FREE_SLEEP_API="$API" sh "$0" "$@"
  elif [ "$DRY_RUN" -ne 1 ] && [ "$MODE" != "status" ]; then
    echo "autopilot_rollback.sh must run as root." >&2
    exit 1
  fi
fi

TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
WORK_DIR="$(mktemp -d 2>/dev/null || echo "/tmp/autopilot-rollback.$$")"
mkdir -p "$WORK_DIR"
LOCK_DIR="/tmp/autopilot-rollback.lock"
HAVE_LOCK=0
# Set while --full has free-sleep stopped; any exit in that window starts it again.
SERVER_STOPPED=0

cleanup() {
  if [ "$SERVER_STOPPED" -eq 1 ]; then
    SERVER_STOPPED=0
    log "Exiting with free-sleep stopped; starting it again."
    systemctl start free-sleep >/dev/null 2>&1 || log "WARNING: systemctl start free-sleep failed; run it by hand."
  fi
  rm -rf "$WORK_DIR"
  if [ "$HAVE_LOCK" -eq 1 ]; then
    rm -rf "$LOCK_DIR"
  fi
}
trap cleanup EXIT
trap 'exit 1' INT TERM HUP

log() {
  line="$(date '+%Y-%m-%d %H:%M:%S') [rollback:$MODE] $*"
  # A closed terminal (dropped SSH) must not stop the script; the log file still gets the line.
  echo "$line" 2>/dev/null || true
  if [ "$DRY_RUN" -ne 1 ] && [ "$MODE" != "status" ]; then
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null
    echo "$line" >> "$LOG_FILE" 2>/dev/null || true
  fi
}

# Append a file's contents to the log (used to keep the pre-rollback status).
log_file_contents() {
  if [ "$DRY_RUN" -ne 1 ] && [ -f "$1" ]; then
    { cat "$1"; echo; } >> "$LOG_FILE" 2>/dev/null || true
  fi
}

# Run a command, or only print it in dry-run mode.
run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[dry-run] $*"
    return 0
  fi
  "$@"
}

pause_seconds() {
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[dry-run] sleep $1"
  else
    sleep "$1"
  fi
}

# Only one rollback at a time; a lock left by a dead process is taken over.
acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "$$" > "$LOCK_DIR/pid"
    HAVE_LOCK=1
    return 0
  fi
  lock_pid="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
    echo "Another autopilot_rollback.sh is running (pid $lock_pid)." >&2
    exit 1
  fi
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR" && echo "$$" > "$LOCK_DIR/pid" && HAVE_LOCK=1
}

# Pick a Python: the biometrics venv if present, else the system python3.
PYTHON=""
for python_candidate in /home/dac/venv/bin/python python3 python; do
  if command -v "$python_candidate" >/dev/null 2>&1; then
    PYTHON="$python_candidate"
    break
  fi
done

# JSON helper. Subcommands:
#   states STATUS                 -> "<side> <enabled> <mode> <state> <anchorF> <appliedOffset> <lastWrittenF>"
#   backstop STATUS DEVICE [LATEST] -> "<side> <anchorF>" for sides still on lastWrittenF != anchorF
#                                    (anchor from STATUS; lastWrittenF from LATEST when it has one)
#   all-off STATUS                -> exit 0 when both sides are disabled and OFF
#   decisions STATUS COUNT        -> newest decisions, one per line
#   settings-disable FILE         -> set autopilot.enabled=false where present (atomic)
#   settings-strip FILE           -> drop the autopilot key from both sides (atomic)
#   settings-summary FILE         -> "<side> enabled=<value>" from settingsDB.json
#   json-ok FILE                  -> exit 0 when FILE holds valid JSON
py_json() {
  if [ -z "$PYTHON" ]; then
    echo "python not found" >&2
    return 3
  fi
  "$PYTHON" - "$@" <<'PYEOF'
import json, os, shutil, sys, tempfile

SIDES = ("left", "right")

def load(path):
    with open(path) as handle:
        return json.load(handle)

def num(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None

def fmt(value):
    return "-" if value is None else str(value)

def atomic_write(path, data):
    folder = os.path.dirname(os.path.abspath(path))
    handle, tmp_path = tempfile.mkstemp(prefix=".settingsDB.", dir=folder)
    with os.fdopen(handle, "w") as out:
        json.dump(data, out, indent=2)
        out.write("\n")
    try:
        shutil.copymode(path, tmp_path)
        stat = os.stat(path)
        os.chown(tmp_path, stat.st_uid, stat.st_gid)
    except OSError:
        pass
    try:
        shutil.chown(tmp_path, "dac", "dac")
    except (LookupError, OSError):
        pass
    os.replace(tmp_path, path)

def main(argv):
    command = argv[0]
    if command == "json-ok":
        load(argv[1])
        return 0
    if command == "states":
        status = load(argv[1])
        for side in SIDES:
            info = status.get(side) or {}
            print(side, fmt(info.get("enabled")), fmt(info.get("mode")), fmt(info.get("state")),
                  fmt(num(info.get("anchorF"))), fmt(num(info.get("appliedOffset"))),
                  fmt(num(info.get("lastWrittenF"))))
        return 0
    if command == "backstop":
        status, device = load(argv[1]), load(argv[2])
        latest = load(argv[3]) if len(argv) > 3 else {}
        for side in SIDES:
            info = status.get(side) or {}
            anchor, written = num(info.get("anchorF")), num(info.get("lastWrittenF"))
            latest_written = num((latest.get(side) or {}).get("lastWrittenF"))
            if latest_written is not None:
                written = latest_written
            target = num((device.get(side) or {}).get("targetTemperatureF"))
            if anchor is None or written is None or target is None:
                continue
            anchor = int(round(anchor))
            if 55 <= anchor <= 110 and target == written and written != anchor:
                print(side, anchor)
        return 0
    if command == "all-off":
        status = load(argv[1])
        ok = all((status.get(side) or {}).get("state") == "OFF"
                 and (status.get(side) or {}).get("enabled") is not True for side in SIDES)
        return 0 if ok else 1
    if command == "decisions":
        status, count = load(argv[1]), int(argv[2])
        rows = []
        for side in SIDES:
            for decision in (status.get(side) or {}).get("decisions") or []:
                if not isinstance(decision, dict):
                    continue
                when = decision.get("at", decision.get("ts", decision.get("time", "")))
                text = decision.get("sentence") or decision.get("message") or json.dumps(decision)
                rows.append((str(when), side, text))
        rows.sort(key=lambda row: row[0])
        for when, side, text in rows[-count:]:
            print("  %s %-5s %s" % (when, side, text))
        if not rows:
            print("  (no decisions)")
        return 0
    if command in ("settings-disable", "settings-strip"):
        path = argv[1]
        data = load(path)
        changed = 0
        for side in SIDES:
            side_settings = data.get(side)
            if not isinstance(side_settings, dict) or "autopilot" not in side_settings:
                continue
            if command == "settings-strip":
                del side_settings["autopilot"]
                changed += 1
            elif isinstance(side_settings["autopilot"], dict) and side_settings["autopilot"].get("enabled") is not False:
                side_settings["autopilot"]["enabled"] = False
                changed += 1
        if changed:
            atomic_write(path, data)
        print(changed)
        return 0
    if command == "settings-summary":
        data = load(argv[1])
        for side in SIDES:
            autopilot = (data.get(side) or {}).get("autopilot")
            value = autopilot.get("enabled") if isinstance(autopilot, dict) else "absent"
            print("%s enabled=%s" % (side, value))
        return 0
    print("unknown command " + command, file=sys.stderr)
    return 2

try:
    sys.exit(main(sys.argv[1:]))
except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
    print("py_json: %s" % error, file=sys.stderr)
    sys.exit(4)
PYEOF
}

# GET $1 into file $2; prints the HTTP code ("000" when unreachable).
api_get() {
  curl -sS -o "$2" -w '%{http_code}' --connect-timeout 3 --max-time 10 "$API$1" 2>/dev/null || true
}

# POST JSON $2 to $1; prints the HTTP code. Dry-run prints the request instead.
api_post() {
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[dry-run] POST $API$1 $2" >&2
    echo "200"
    return 0
  fi
  curl -sS -o "$WORK_DIR/post.out" -w '%{http_code}' --connect-timeout 3 --max-time 15 \
    -X POST -H 'Content-Type: application/json' -d "$2" "$API$1" 2>/dev/null || true
}

unit_exists() {
  [ -f "$ENV_UNIT_FILE" ] || systemctl cat "$ENV_UNIT" >/dev/null 2>&1
}

stop_environment_service() {
  if unit_exists; then
    log "Disabling and stopping $ENV_UNIT"
    run systemctl disable --now "$ENV_UNIT" >/dev/null 2>&1 || true
  else
    log "$ENV_UNIT not installed; nothing to stop."
  fi
}

# Wait up to $1 seconds for /api/serverStatus to answer 200.
wait_for_server() {
  deadline=$(( $(date +%s) + $1 ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if [ "$(api_get /api/serverStatus "$WORK_DIR/serverStatus.json")" = "200" ]; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Count "[autopilot] ... wrote" journal lines since $1 (restore lines ignored).
autopilot_writes_since() {
  if ! command -v journalctl >/dev/null 2>&1; then
    echo 0
    return 0
  fi
  journalctl -u free-sleep --since "$1" --no-pager -o cat 2>/dev/null \
    | grep '\[autopilot\]' | grep 'wrote' | grep -vic 'restor' || true
}

# Fallback for --soft when the API is down: edit settingsDB.json, then restart.
soft_offline() {
  log "API unreachable; disabling Autopilot in $SETTINGS_FILE directly."
  if [ ! -f "$SETTINGS_FILE" ]; then
    log "No $SETTINGS_FILE; Autopilot cannot be enabled. Nothing to edit."
  elif [ "$DRY_RUN" -eq 1 ]; then
    echo "[dry-run] $PYTHON settings-disable $SETTINGS_FILE"
  else
    changed="$(py_json settings-disable "$SETTINGS_FILE")" || {
      log "FAIL: could not edit $SETTINGS_FILE (python missing or invalid JSON)."
      return 1
    }
    log "Sides changed in settingsDB.json: $changed"
  fi
  stop_environment_service
  log "Restarting free-sleep (frank is not touched)."
  run systemctl restart free-sleep || log "WARNING: systemctl restart free-sleep failed."
  if [ "$DRY_RUN" -eq 1 ]; then
    log "PASS (dry run)"
    return 0
  fi
  if ! wait_for_server 60; then
    log "FAIL: free-sleep did not answer /api/serverStatus within 60 s."
    return 1
  fi
  log "NOTE: the anchor backstop needs the API; check the bed temperature in the app."
  status_code="$(api_get /api/autopilot/status "$WORK_DIR/status-after.json")"
  if [ "$status_code" = "404" ] || py_json all-off "$WORK_DIR/status-after.json"; then
    log "PASS: Autopilot is off."
    return 0
  fi
  log "FAIL: Autopilot status is not OFF on both sides after restart."
  return 1
}

# --soft: disable via API, backstop the anchor, stop the environment service, verify.
soft_rollback() {
  log "Soft rollback starting."
  status_code="$(api_get /api/autopilot/status "$WORK_DIR/status-before.json")"
  case "$status_code" in
    200)
      log "Autopilot status before rollback:"
      log_file_contents "$WORK_DIR/status-before.json"
      py_json states "$WORK_DIR/status-before.json" | while IFS= read -r row; do log "  $row"; done
      ;;
    404)
      log "Server has no /api/autopilot (pre-Autopilot build). Nothing to disable in the API."
      stop_environment_service
      log "PASS: Autopilot is not active."
      return 0
      ;;
    000)
      soft_offline
      return $?
      ;;
    *)
      log "Unexpected HTTP $status_code from /api/autopilot/status; using the offline path."
      soft_offline
      return $?
      ;;
  esac

  disable_since="$(date '+%Y-%m-%d %H:%M:%S')"
  post_code="$(api_post /api/settings '{"left":{"autopilot":{"enabled":false}},"right":{"autopilot":{"enabled":false}}}')"
  if [ "$post_code" != "200" ]; then
    log "POST /api/settings returned HTTP $post_code; using the offline path."
    soft_offline
    return $?
  fi
  log "Autopilot disabled in settings; waiting for the server to restore anchors."
  pause_seconds 5
  soft_backstop

  stop_environment_service

  if [ "$DRY_RUN" -eq 1 ]; then
    log "PASS (dry run)"
    return 0
  fi
  if soft_verify "$disable_since"; then
    return 0
  fi
  # A tick that was already in flight may have written after the first backstop: redo it with
  # the newest lastWrittenF and check again.
  # The late write is history once the backstop has undone it, so count writes from here on.
  log "Re-running the anchor backstop with the latest status, then verifying again."
  retry_since="$(date '+%Y-%m-%d %H:%M:%S')"
  soft_backstop "$WORK_DIR/status-after.json"
  pause_seconds 3
  soft_verify "$retry_since"
}

# Backstop: put a side back on its pre-rollback anchor when it still sits on Autopilot's last
# write. $1 (optional) is a newer status file whose lastWrittenF replaces the pre-rollback one.
soft_backstop() {
  if [ "$(api_get /api/deviceStatus "$WORK_DIR/device.json")" != "200" ]; then
    log "WARNING: could not read /api/deviceStatus; backstop skipped."
    return 0
  fi
  if [ -n "${1:-}" ] && [ -f "$1" ]; then
    py_json backstop "$WORK_DIR/status-before.json" "$WORK_DIR/device.json" "$1" > "$WORK_DIR/backstop.txt" || true
  else
    py_json backstop "$WORK_DIR/status-before.json" "$WORK_DIR/device.json" > "$WORK_DIR/backstop.txt" || true
  fi
  while read -r side anchor; do
    [ -n "$side" ] || continue
    log "Backstop: $side still on Autopilot's value; setting targetTemperatureF=$anchor"
    code="$(api_post /api/deviceStatus "{\"$side\":{\"targetTemperatureF\":$anchor}}")"
    [ "$code" = "204" ] || [ "$code" = "200" ] || log "WARNING: backstop for $side returned HTTP $code"
  done < "$WORK_DIR/backstop.txt"
}

# Verify: both sides OFF (allow up to ~15 s for the job rebuild) and no autopilot writes since $1.
soft_verify() {
  attempt=0
  verified=1
  while [ "$attempt" -lt 5 ]; do
    status_code="$(api_get /api/autopilot/status "$WORK_DIR/status-after.json")"
    if [ "$status_code" = "404" ] || { [ "$status_code" = "200" ] && py_json all-off "$WORK_DIR/status-after.json"; }; then
      verified=0
      break
    fi
    attempt=$((attempt + 1))
    sleep 3
  done
  if [ "$status_code" = "200" ]; then
    py_json states "$WORK_DIR/status-after.json" | while IFS= read -r row; do log "  after: $row"; done
  fi
  writes="$(autopilot_writes_since "$1")"
  if [ "$verified" -eq 0 ] && [ "${writes:-0}" -eq 0 ]; then
    log "PASS: Autopilot is OFF on both sides and made no writes since $1."
    return 0
  fi
  log "FAIL: status OFF check=$verified (0=ok), autopilot writes since disable=$writes."
  return 1
}

# Newest snapshot made without Autopilot; prints nothing when every snapshot has Autopilot
# (restoring one of those would put the same Autopilot build back).
pick_snapshot() {
  for snapshot_file in $(ls -1t "$ROLLBACK_DIR"/*.tgz 2>/dev/null); do
    if [ "$(sed -n 's/^autopilot=//p' "${snapshot_file%.tgz}.meta" 2>/dev/null)" = "no" ]; then
      echo "$snapshot_file"
      return 0
    fi
  done
}

# First git sha from LAST_GOOD (pre_autopilot_sha, then sha) whose commit exists and has no
# Autopilot sources; prints nothing when none qualifies.
pick_git_sha() {
  for key in pre_autopilot_sha sha; do
    candidate_sha="$(sed -n "s/^$key=//p" "$ROLLBACK_DIR/LAST_GOOD" 2>/dev/null | head -n 1)"
    [ -n "$candidate_sha" ] || continue
    git -C "$APP_DIR" cat-file -e "$candidate_sha^{commit}" 2>/dev/null || continue
    if git -C "$APP_DIR" cat-file -e "$candidate_sha:server/src/autopilot/decide.ts" 2>/dev/null; then
      continue
    fi
    echo "$candidate_sha"
    return 0
  done
}

# Replace server/dist and server/public with the copies inside snapshot $1.
restore_from_snapshot() {
  snapshot_file="$1"
  staging="$APP_DIR/.autopilot-restore"
  run rm -rf "$staging"
  run mkdir -p "$staging" || return 1
  if ! run tar -xzf "$snapshot_file" -C "$staging"; then
    run rm -rf "$staging"
    return 1
  fi
  restored=0
  for code_dir in server/dist server/public; do
    staged_dir="$staging/${APP_DIR#/}/$code_dir"
    if [ "$DRY_RUN" -ne 1 ] && [ ! -d "$staged_dir" ]; then
      log "Snapshot has no $code_dir; leaving the current one."
      continue
    fi
    log "Restoring $code_dir (previous copy kept as $code_dir.pre-rollback)"
    run rm -rf "$APP_DIR/$code_dir.pre-rollback"
    if [ -d "$APP_DIR/$code_dir" ]; then
      run mv "$APP_DIR/$code_dir" "$APP_DIR/$code_dir.pre-rollback" || return 1
    fi
    run mv "$staged_dir" "$APP_DIR/$code_dir" || return 1
    run chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/$code_dir"
    restored=$((restored + 1))
  done
  run rm -rf "$staging"
  [ "$DRY_RUN" -eq 1 ] || [ "$restored" -gt 0 ]
}

# Check out the LAST_GOOD sha and rebuild the server (and the app if it can be built).
restore_from_git() {
  sha="$1"
  log "Checking out $sha -- server app biometrics in $APP_DIR"
  run git -C "$APP_DIR" checkout "$sha" -- server app biometrics || return 1
  run chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
  # Build output goes to the log file, so a closed terminal cannot break the build with EPIPE.
  log "Rebuilding server with tsc (output in $LOG_FILE)"
  run su "$SERVICE_USER" -s /bin/sh -c "cd '$APP_DIR/server' && PATH='$VOLTA_BIN':\$PATH npx tsc" >> "$build_output" 2>&1 \
    || log "WARNING: server tsc reported errors (output was still emitted)."
  if [ -d "$APP_DIR/app/node_modules" ]; then
    log "Rebuilding app (output in $LOG_FILE)"
    run su "$SERVICE_USER" -s /bin/sh -c "cd '$APP_DIR/app' && PATH='$VOLTA_BIN':\$PATH npm run build" >> "$build_output" 2>&1 \
      || log "WARNING: app build failed; the current app build stays (it hides Autopilot when the API is gone)."
  else
    log "app/node_modules missing; keeping the current app build (it hides Autopilot when the API is gone)."
  fi
  return 0
}

# --full: soft rollback, restore the pre-Autopilot build, clean settings and units.
full_rollback() {
  soft_rollback || log "Soft step reported FAIL; continuing with the full rollback."

  # From here on a dropped SSH session must not kill the script while free-sleep is stopped:
  # ignore hangups and broken pipes (log() and the builds tolerate a closed terminal).
  trap '' HUP PIPE
  build_output="$LOG_FILE"
  [ "$DRY_RUN" -eq 1 ] && build_output=/dev/stderr

  # Decide the restore source before stopping anything, so an abort leaves the server running.
  # Only a pre-Autopilot build counts; restoring an Autopilot snapshot would change nothing.
  snapshot_file="$(pick_snapshot)"
  git_sha=""
  if [ -z "$snapshot_file" ]; then
    git_sha="$(pick_git_sha)"
    if [ -z "$git_sha" ]; then
      log "ABORT: no pre-Autopilot snapshot in $ROLLBACK_DIR and no LAST_GOOD git sha without Autopilot."
      log "Manual fix: git -C $APP_DIR checkout <pre-autopilot-sha> -- server app biometrics && (cd $APP_DIR/server && npx tsc) && systemctl restart free-sleep"
      log "Autopilot itself is already disabled by the soft step."
      return 1
    fi
    log "No pre-Autopilot snapshot; rebuilding from git sha $git_sha."
  fi

  log "Stopping free-sleep (frank is not touched)."
  run systemctl stop free-sleep || log "WARNING: systemctl stop free-sleep failed."
  [ "$DRY_RUN" -eq 1 ] || SERVER_STOPPED=1

  restore_ok=0
  if [ -n "$snapshot_file" ]; then
    log "Restoring from snapshot $snapshot_file"
    restore_from_snapshot "$snapshot_file" || restore_ok=1
  else
    restore_from_git "$git_sha" || restore_ok=1
  fi
  [ "$restore_ok" -eq 0 ] || log "WARNING: code restore failed; starting the current build again."

  if [ -f "$SETTINGS_FILE" ]; then
    log "Backing up settingsDB.json to settingsDB.json.pre-rollback-$TIMESTAMP and removing the autopilot key."
    run cp -p "$SETTINGS_FILE" "$SETTINGS_FILE.pre-rollback-$TIMESTAMP"
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "[dry-run] $PYTHON settings-strip $SETTINGS_FILE"
    else
      changed="$(py_json settings-strip "$SETTINGS_FILE")" \
        && log "Sides cleaned: $changed" \
        || log "WARNING: could not strip the autopilot key from $SETTINGS_FILE."
    fi
  fi

  if [ -f "$ENV_UNIT_FILE" ]; then
    log "Removing $ENV_UNIT_FILE"
    run systemctl disable --now "$ENV_UNIT" >/dev/null 2>&1 || true
    run rm -f "$ENV_UNIT_FILE"
    run systemctl daemon-reload
    run systemctl reset-failed "$ENV_UNIT" >/dev/null 2>&1 || true
  fi

  if [ "$PURGE" -eq 1 ]; then
    log "Purging $AUTOPILOT_STATE_DIR"
    run rm -rf "$AUTOPILOT_STATE_DIR"
  else
    log "Keeping $AUTOPILOT_STATE_DIR (use --purge to delete it)."
  fi

  log "Starting free-sleep."
  run systemctl start free-sleep || log "WARNING: systemctl start free-sleep failed."
  SERVER_STOPPED=0
  if [ "$DRY_RUN" -eq 1 ]; then
    log "PASS (dry run)"
    return 0
  fi
  if wait_for_server 60; then
    autopilot_code="$(api_get /api/autopilot/status "$WORK_DIR/status-final.json")"
    log "free-sleep is up; /api/autopilot/status now returns HTTP $autopilot_code (404 = removed)."
    if [ "$restore_ok" -ne 0 ]; then
      log "FAIL: server is up but the code restore failed."
      return 1
    fi
    if [ "$autopilot_code" != "404" ]; then
      log "FAIL: the restored build still serves /api/autopilot; Autopilot code is still installed."
      return 1
    fi
    log "PASS: full rollback complete."
    return 0
  fi
  log "FAIL: free-sleep did not answer /api/serverStatus within 60 s. See: journalctl -u free-sleep -n 100"
  return 1
}

# --status: read-only report.
status_report() {
  echo "Autopilot status ($API)"
  status_code="$(api_get /api/autopilot/status "$WORK_DIR/status.json")"
  case "$status_code" in
    200)
      echo "  side  enabled mode state anchorF offset lastWrittenF"
      py_json states "$WORK_DIR/status.json" | sed 's/^/  /'
      ;;
    404) echo "  Server has no /api/autopilot (pre-Autopilot build or rolled back)." ;;
    000)
      echo "  API unreachable."
      if [ -f "$SETTINGS_FILE" ]; then
        echo "  settingsDB.json:"
        py_json settings-summary "$SETTINGS_FILE" | sed 's/^/    /'
      fi
      ;;
    *) echo "  Unexpected HTTP $status_code." ;;
  esac

  if unit_exists; then
    echo "Environment service: $(systemctl is-active "$ENV_UNIT" 2>/dev/null || true), $(systemctl is-enabled "$ENV_UNIT" 2>/dev/null || true)"
  else
    echo "Environment service: not installed"
  fi

  newest="$(ls -1t "$ROLLBACK_DIR"/*.tgz 2>/dev/null | head -n 1)"
  if [ -n "$newest" ]; then
    age_hours=$(( ($(date +%s) - $(stat -c %Y "$newest")) / 3600 ))
    echo "Newest snapshot: $newest (${age_hours} h old, autopilot=$(sed -n 's/^autopilot=//p' "${newest%.tgz}.meta" 2>/dev/null))"
    pre_autopilot_snapshot="$(pick_snapshot)"
    echo "Pre-Autopilot snapshot: ${pre_autopilot_snapshot:-none (--full will need a pre-Autopilot LAST_GOOD git sha)}"
  else
    echo "Newest snapshot: none in $ROLLBACK_DIR"
  fi
  [ -f "$ROLLBACK_DIR/LAST_GOOD" ] && echo "LAST_GOOD: $(tr '\n' ' ' < "$ROLLBACK_DIR/LAST_GOOD")"

  if [ "$status_code" = "200" ]; then
    echo "Last 10 decisions:"
    py_json decisions "$WORK_DIR/status.json" 10
  fi
  return 0
}

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 1
fi
if [ -z "$PYTHON" ]; then
  echo "WARNING: no python found; JSON checks and the offline path will fail." >&2
fi

case "$MODE" in
  status)
    status_report
    exit $?
    ;;
  soft)
    acquire_lock
    [ "$DRY_RUN" -eq 1 ] && log "DRY RUN: nothing will be changed."
    soft_rollback
    exit $?
    ;;
  full)
    acquire_lock
    [ "$DRY_RUN" -eq 1 ] && log "DRY RUN: nothing will be changed."
    full_rollback
    exit $?
    ;;
esac
