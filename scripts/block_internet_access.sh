#!/bin/bash

# Set PATH to ensure iptables and ip6tables can be found when run from cron
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# IPv4 Rules
echo "Configuring IPv4 rules..."

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
NEW_TIME_SYNC_CONFIG="[Time]
NTP=pool.ntp.org
FallbackNTP=time1.google.com time2.google.com time3.google.com time4.google.com"

echo "$NEW_TIME_SYNC_CONFIG" > "/etc/systemd/timesyncd.conf"

# Restart timesyncd to apply changes
systemctl restart systemd-timesyncd

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

