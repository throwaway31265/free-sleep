#!/bin/bash

systemctl stop free-sleep
systemctl disable free-sleep
sh /home/dac/free-sleep/scripts/unblock_internet_access.sh
rm -rf /home/dac/free-sleep
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/nikita/free-sleep/main/scripts/install.sh)"
sh /home/dac/free-sleep/scripts/block_internet_access.sh

