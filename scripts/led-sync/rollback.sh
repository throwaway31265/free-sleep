#!/bin/sh
# Turn off the front LED sync and give the LED back to Capybara.
#   led-sync-rollback.sh                    stop + disable (LED returns to white)
#   led-sync-rollback.sh --restart-capybara also restart Capybara so it re-inits the LED
#   led-sync-rollback.sh --purge            also remove the daemon files
# Quick kill switch without this script: set LED_SYNC_ENABLED=0 in /etc/default/led-sync and
# run: systemctl restart led-sync
set -u
[ "$(id -u)" -eq 0 ] || exec sudo sh "$0" "$@"

RESTART_CAPYBARA=0
PURGE=0
for arg in "$@"; do
  case "$arg" in
    --restart-capybara) RESTART_CAPYBARA=1 ;;
    --purge) PURGE=1 ;;
    *) echo "unknown option: $arg"; exit 2 ;;
  esac
done

systemctl disable --now led-sync 2>/dev/null || true
if [ "$PURGE" -eq 1 ]; then
  rm -f /etc/systemd/system/led-sync.service /etc/default/led-sync
  rm -rf /usr/local/lib/led-sync
  systemctl daemon-reload
fi
if [ "$RESTART_CAPYBARA" -eq 1 ]; then
  systemctl restart capybara
fi
echo "led-sync: $(systemctl is-active led-sync 2>/dev/null)  capybara: $(systemctl is-active capybara)"
[ "$PURGE" -eq 1 ] && rm -f /usr/local/sbin/led-sync-rollback.sh
exit 0
