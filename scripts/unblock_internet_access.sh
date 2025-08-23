#!/bin/bash

# Set PATH to ensure iptables can be found when run from cron
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X

echo "Unblocked internet access!"
