#!/bin/bash

echo "Unblocking internet access..."

iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X

echo "Unblocked internet access!"
