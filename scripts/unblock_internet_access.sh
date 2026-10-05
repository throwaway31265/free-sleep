#!/bin/bash

echo "Unblocking internet access..."

iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X

ip6tables -F
ip6tables -X
ip6tables -t nat -F 2>/dev/null || true
ip6tables -t nat -X 2>/dev/null || true

echo "Unblocked internet access!"
