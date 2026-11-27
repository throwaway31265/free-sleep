#!/bin/sh
# Install the front LED sync daemon on the pod (run as root from this directory).
# Keeps files outside /home/dac/free-sleep so free-sleep updates don't remove them.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)

install -d /usr/local/lib/led-sync /usr/local/sbin
install -m 755 "$HERE/led_sync.py" /usr/local/lib/led-sync/led_sync.py
install -m 644 "$HERE/led-sync.service" /etc/systemd/system/led-sync.service
[ -f /etc/default/led-sync ] || install -m 644 "$HERE/led-sync.default" /etc/default/led-sync
install -m 755 "$HERE/rollback.sh" /usr/local/sbin/led-sync-rollback.sh

systemctl daemon-reload
systemctl enable --now led-sync
sleep 4
systemctl is-active led-sync
journalctl -u led-sync -n 5 --no-pager -o cat
