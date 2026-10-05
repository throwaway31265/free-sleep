#!/bin/bash

echo "Blocking internet access..."
firewall_rules_status=0

# Move an allowance ahead of existing DROP rules without accumulating duplicates.
prepend_firewall_rule() (
  firewall_command="$1"
  shift
  while "$firewall_command" -C "$@" 2>/dev/null; do
    "$firewall_command" -D "$@" || return 1
  done
  "$firewall_command" -I "$@"
)

# DNS must survive resolver changes and upgrades that leave old firewall rules active.
allow_dns_traffic() {
  echo "Allowing DNS queries and established replies..."
  for firewall_command in iptables ip6tables; do
    for protocol in udp tcp; do
      prepend_firewall_rule "$firewall_command" OUTPUT -p "$protocol" --dport 53 -j ACCEPT || return 1
      prepend_firewall_rule "$firewall_command" INPUT -p "$protocol" --sport 53 \
        -m conntrack --ctstate ESTABLISHED -j ACCEPT || return 1
    done
  done
}

# IPv4 Rules
echo "Configuring IPv4 rules..."

# -----------------------------------------------------------------------------------------------------
# Allow traffic to Sentry servers for error logging

# https://docs.sentry.io/security-legal-pii/security/ip-ranges/#event-ingestion
# Organization ingestion ranges used by our DSNs; verified 2026-10-05.

# Check if ALLOW_SENTRY is true
if [ "$ALLOW_SENTRY" = "false" ]; then
  echo "ALLOW_SENTRY is not true — skipping Sentry firewall configuration."

else
  echo -e "\e[33mIP rules were setup to allow error logs to be sent to Sentry servers\e[0m"
  echo -e "\e[33mSentry error logs will NOT be sent to Sentry unless error logging is explicitly enabled in the UI. (It's off by default)\e[0m"
  echo -e "\e[33mIf you'd like to block Sentry servers, run: 'ALLOW_SENTRY=false sh scripts/block_internet_access.sh'\e[0m"
  echo -e "\e[33m\e[0m"
  iptables -C INPUT  -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || \
  iptables -I INPUT  -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  iptables -C OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || \
  iptables -I OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

  for sentry_range in 34.160.81.0/32 34.102.210.18/32; do
    prepend_firewall_rule iptables OUTPUT -d "$sentry_range" -j ACCEPT || firewall_rules_status=1
  done
  for sentry_range in 2600:1901:0:5e8a::/64 2600:1901:0:7edb::/64; do
    prepend_firewall_rule ip6tables OUTPUT -d "$sentry_range" -j ACCEPT || firewall_rules_status=1
    prepend_firewall_rule ip6tables INPUT -s "$sentry_range" \
      -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT || firewall_rules_status=1
  done
  if [ "$firewall_rules_status" -eq 0 ]; then
    echo "Sentry error logging IP rules applied successfully."
  else
    echo "Failed to install Sentry allowances; error logging may fail." >&2
  fi
fi

# -----------------------------------------------------------------------------------------------------

# Allow LAN traffic Class A (10.0.0.0/8)
iptables -A INPUT -s 10.0.0.0/8 -j ACCEPT
iptables -A OUTPUT -d 10.0.0.0/8 -j ACCEPT

# Allow LAN traffic Class B (172.16.0.0/12)
iptables -A INPUT -s 172.16.0.0/12 -j ACCEPT
iptables -A OUTPUT -d 172.16.0.0/12 -j ACCEPT

# Allow LAN traffic Class C (192.168.0.0/16)
iptables -A INPUT -s 192.168.0.0/16 -j ACCEPT
iptables -A OUTPUT -d 192.168.0.0/16 -j ACCEPT

if ! allow_dns_traffic; then
  echo "Failed to install DNS allowances; time synchronization may fail." >&2
  firewall_rules_status=1
fi

# Allow NTP traffic - this allows us to synchronize the system time
iptables -I OUTPUT -p udp --dport 123 -j ACCEPT
iptables -I INPUT -p udp --sport 123 -j ACCEPT

echo "Updating the timesyncd config"
# New configuration content
cat > /etc/systemd/timesyncd.conf <<EOF
[Time]
NTP=pool.ntp.org 0.pool.ntp.org 1.pool.ntp.org 2.pool.ntp.org 3.pool.ntp.org
FallbackNTP=time1.google.com time2.google.com time3.google.com time4.google.com
RootDistanceMaxSec=5
PollIntervalMinSec=32
PollIntervalMaxSec=2048
EOF

# Restart timesyncd to apply changes
systemctl restart systemd-timesyncd


# Allow localhost (loopback) traffic so local apps can talk to each other
iptables -A INPUT  -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Block everything else
iptables -A INPUT -j DROP
iptables -A OUTPUT -j DROP

# Save rules
iptables-save > /etc/iptables/iptables.rules

echo "Configuring IPv6 rules..."
# Allow local traffic for IPv6
ip6tables -A INPUT -s fe80::/10 -j ACCEPT
ip6tables -A OUTPUT -d fe80::/10 -j ACCEPT
ip6tables -A INPUT -s fd00::/8 -j ACCEPT
ip6tables -A OUTPUT -d fd00::/8 -j ACCEPT

# Allow NTP traffic (IPv6)
ip6tables -I OUTPUT -p udp --dport 123 -j ACCEPT
ip6tables -I INPUT -p udp --sport 123 -j ACCEPT

# Block everything else (IPv6)
ip6tables -A INPUT -j DROP
ip6tables -A OUTPUT -j DROP
ip6tables-save > /etc/iptables/ip6tables.rules

if [ "$firewall_rules_status" -ne 0 ]; then
  exit "$firewall_rules_status"
fi

echo "Blocked WAN internet access successfully!"
