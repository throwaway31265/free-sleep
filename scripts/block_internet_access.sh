#!/bin/bash

echo "Blocking internet access..."

# IPv4 Rules
echo "Configuring IPv4 rules..."

# -----------------------------------------------------------------------------------------------------
# Allow traffic to Sentry servers for error logging

# https://docs.sentry.io/security-legal-pii/security/ip-ranges/#event-ingestion

# Check if ALLOW_SENTRY is true
if [ "$ALLOW_SENTRY" = "false" ]; then
  echo "ALLOW_SENTRY is not true — skipping Sentry firewall configuration."

else
  echo -e "\e[33mIP rules were setup to allow error logs to be sent to Sentry servers\e[0m"
  echo -e "\e[33mSentry error logs will NOT be sent to Sentry unless error logging is explicitly enabled in the UI. (It's off by default)\e[0m"
  echo -e "\e[33mIf you'd like to block Sentry servers, run: 'ALLOW_SENTRY=false sh scripts/block_internet_access.sh'\e[0m"
  echo -e "\e[33m\e[0m"
  # --- US IPs ---
  iptables -C INPUT  -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || \
  iptables -I INPUT  -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  iptables -C OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || \
  iptables -I OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

  iptables -A OUTPUT -d 35.186.247.156 -j ACCEPT
  iptables -A OUTPUT -d 34.120.195.249 -j ACCEPT
  iptables -A OUTPUT -d 34.36.122.224  -j ACCEPT
  iptables -A OUTPUT -d 34.36.87.148 -j ACCEPT
  iptables -A OUTPUT -d 34.120.62.213 -j ACCEPT
  iptables -A OUTPUT -d 130.211.36.74 -j ACCEPT
  echo "Sentry error logging IP rules applied successfully."
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

echo "Blocked WAN internet access successfully!"

