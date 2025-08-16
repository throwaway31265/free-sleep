#!/bin/sh
set -e

echo "Disabling IPv6 (runtime)..."
sysctl -w net.ipv6.conf.all.disable_ipv6=1 || true
sysctl -w net.ipv6.conf.default.disable_ipv6=1 || true
sysctl -w net.ipv6.conf.lo.disable_ipv6=1 || true

if [ -f /etc/sysctl.conf ]; then
  echo "Persisting IPv6 disable across reboots in /etc/sysctl.conf..."
  sed -i '/net.ipv6.conf.all.disable_ipv6/d' /etc/sysctl.conf || true
  sed -i '/net.ipv6.conf.default.disable_ipv6/d' /etc/sysctl.conf || true
  sed -i '/net.ipv6.conf.lo.disable_ipv6/d' /etc/sysctl.conf || true
  echo 'net.ipv6.conf.all.disable_ipv6=1' >> /etc/sysctl.conf
  echo 'net.ipv6.conf.default.disable_ipv6=1' >> /etc/sysctl.conf
  echo 'net.ipv6.conf.lo.disable_ipv6=1' >> /etc/sysctl.conf
  sysctl -p || true
fi

echo "IPv6 disabled."
