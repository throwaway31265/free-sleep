#!/bin/bash

# Eight Sleep Pod Modification Script
# Usage (inside WSL/Linux, from a folder on the Linux filesystem that holds rootfs.tar.gz):
#   sudo bash ./modify_eight_sleep.sh

set -euo pipefail  # Exit on any error, unset variable, or failed pipe

# Configuration - Edit these variables
WIFI_SSID='YOUR_WIFI_SSID' # 2.4 GHz, WPA2-Personal network the Pod should join
WIFI_PASSWORD='YOUR_WIFI_PASSWORD'
ROOT_PASSWORD='CHANGE_ME' #Set to the new password for root and rewt
SSH_KEY="PASTE_YOUR_PUBLIC_KEY_HERE" #Paste your WHOLE public key (e.g. contents of ~/.ssh/id_rsa.pub). The script checks it is valid.
KEEP_ORIGINAL_SSH_KEYS=false  # Set to false to remove Eight Sleep's SSH keys. Note, later version of the firmware don't have the keys at all
ALLOW_ROOT_SSH=true           # The firmware only allows "rewt" over SSH (AllowUsers rewt). true = also allow root.
REWT_PASSWORDLESS_SUDO=true   # true = rewt can use sudo without a password
MASK_UPDATE_SERVICES=true     # true = mask Eight Sleep's update/cloud services (same list as free-sleep INSTALLATION.md)
MOVE_TO_SD_CARD=true #copy to the SD card when done
SD_CARD_TARGET="/mnt/part1/opt/images/Yocto" #where the SD card partition A is mounted

UPDATE_SERVICES="swupdate-progress.service swupdate.service defibrillator.service eight-kernel.service telegraf.service vector.service frankenfirmware.service dac.service swupdate.socket"

# ------------------------------------------------------------------------------
# Pre-flight checks

die() { echo "Error: $*" >&2; exit 1; }

# Must run as root so tar can keep every file's original owner (dac, rewt, messagebus, ...).
# Repacking without that makes everything root-owned, which breaks the free-sleep install.
[ "$(id -u)" -eq 0 ] || die "run with sudo: sudo bash ./modify_eight_sleep.sh"

# Windows drives (/mnt/c etc.) can't store Linux owners, permissions or symlinks correctly.
case "$(pwd -P)" in
    /mnt/[a-zA-Z]|/mnt/[a-zA-Z]/*) die "run this from a folder on the Linux filesystem (e.g. ~/freesleep), not $(pwd -P)";;
esac

[ -f "rootfs.tar.gz" ] || die "rootfs.tar.gz not found in current directory"

# Refuse to build an image with the placeholder values from the repo copy of this script
for placeholder in "$WIFI_SSID" "$WIFI_PASSWORD" "$ROOT_PASSWORD" "$SSH_KEY"; do
    case "$placeholder" in
        YOUR_WIFI_SSID|YOUR_WIFI_PASSWORD|CHANGE_ME|PASTE_YOUR_PUBLIC_KEY_HERE)
            die "edit the Configuration section at the top of this script first (found placeholder '$placeholder')";;
    esac
done

for cmd in wpa_passphrase openssl ssh-keygen tar gzip; do
    command -v "$cmd" >/dev/null || die "'$cmd' is missing (sudo apt install -y wpasupplicant openssl openssh-client)"
done

# Catch a truncated/mangled key now instead of after a reflash
printf '%s\n' "$SSH_KEY" | ssh-keygen -l -f - >/dev/null 2>&1 \
    || die "SSH_KEY is not a valid public key - paste the whole line from your .pub file"
echo "✓ SSH key OK: $(printf '%s\n' "$SSH_KEY" | ssh-keygen -l -f -)"

generate_hex_psk() {
    local hex_psk
    hex_psk=$(wpa_passphrase "$1" "$2" | grep -o "^[[:space:]]*psk=.*" | cut -d= -f2)
    [ -n "$hex_psk" ] || die "failed to generate hex PSK"
    echo "$hex_psk"
}

# ------------------------------------------------------------------------------
rm -rf extract
mkdir -p extract patched

echo "Step 1: Extracting rootfs.tar.gz (keeping original owners and permissions)..."
tar --numeric-owner --same-owner --same-permissions -xzf rootfs.tar.gz -C extract

echo "Step 2: Setting root and rewt password..."
PASSWORD_HASH_ROOT=$(openssl passwd -1 -salt root "$ROOT_PASSWORD")
PASSWORD_HASH_REWT=$(openssl passwd -1 -salt rewt "$ROOT_PASSWORD")
sed -i "s|^root:[^:]*:|root:$PASSWORD_HASH_ROOT:|" extract/etc/shadow
sed -i "s|^rewt:[^:]*:|rewt:$PASSWORD_HASH_REWT:|" extract/etc/shadow
chown 0:0 extract/etc/shadow
chmod 400 extract/etc/shadow

echo "Step 3: Adding WiFi configuration..."
mkdir -p extract/etc/NetworkManager/system-connections/
HEX_PSK=$(generate_hex_psk "$WIFI_SSID" "$WIFI_PASSWORD")

cat > extract/etc/NetworkManager/system-connections/customer-wifi.nmconnection << EOF
[connection]
id=customer-wifi
uuid=700a7a76-2105-4f46-b1b4-c9f3c791c440
type=802-11-wireless
interface-name=wlan0
autoconnect=yes
autoconnect-priority=0
permissions=

[802-11-wireless]
mac-address-blacklist=
mode=infrastructure
ssid=$WIFI_SSID

[802-11-wireless-security]
auth-alg=open
key-mgmt=wpa-psk
psk=$HEX_PSK

[ipv4]
dns-search=
method=auto

[ipv6]
addr-gen-mode=stable-privacy
dns-search=
method=auto

[proxy]
method=none
EOF
chown 0:0 extract/etc/NetworkManager/system-connections/customer-wifi.nmconnection
chmod 600 extract/etc/NetworkManager/system-connections/customer-wifi.nmconnection

echo "Step 4: Configuring SSH daemon settings..."
for cfg in extract/etc/ssh/sshd_config extract/etc/ssh/sshd_config_readonly; do
    [ -f "$cfg" ] || { echo "! $cfg not found, skipping"; continue; }
    sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin yes/' "$cfg"
    sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication yes/' "$cfg"
    if [ "$ALLOW_ROOT_SSH" = true ]; then
        # Firmware ships "AllowUsers rewt", which blocks root no matter what PermitRootLogin says
        sed -i '/^AllowUsers/{/[[:space:]]root\([[:space:]]\|$\)/!s/$/ root/}' "$cfg"
    fi
    echo "✓ Modified ${cfg#extract} ($(grep -E '^AllowUsers' "$cfg" || echo 'no AllowUsers line'))"
done

echo "Step 5: Configuring SSH keys..."
mkdir -p extract/etc/ssh
if [ "$KEEP_ORIGINAL_SSH_KEYS" = true ] && [ -f "extract/etc/ssh/authorized_keys" ]; then
    printf '%s\n' "$SSH_KEY" >> extract/etc/ssh/authorized_keys
else
    printf '%s\n' "$SSH_KEY" > extract/etc/ssh/authorized_keys
fi
chown 0:0 extract/etc/ssh/authorized_keys
chmod 644 extract/etc/ssh/authorized_keys

if [ "$REWT_PASSWORDLESS_SUDO" = true ]; then
    echo "Step 6: Passwordless sudo for rewt..."
    mkdir -p extract/etc/sudoers.d
    echo 'rewt ALL=(ALL:ALL) NOPASSWD: ALL' > extract/etc/sudoers.d/001_rewt
    chown 0:0 extract/etc/sudoers.d/001_rewt
    chmod 440 extract/etc/sudoers.d/001_rewt
fi

if [ "$MASK_UPDATE_SERVICES" = true ]; then
    echo "Step 7: Masking update services..."
    # Same as "systemctl mask": a unit symlinked to /dev/null in /etc/systemd/system can never start
    mkdir -p extract/etc/systemd/system
    for unit in $UPDATE_SERVICES; do
        ln -sfn /dev/null "extract/etc/systemd/system/$unit"
    done
fi

echo "Step 8: Creating patched rootfs..."
tar --numeric-owner -czf patched/rootfs.tar.gz -C extract .

echo "Step 9: Verifying file owners match the original..."
# List "owner path" for every entry, then compare. Files this script creates or edits are root-owned
# in both, so any difference here means ownership was lost somewhere.
list_owners() { tar --numeric-owner -tvzf "$1" | awk '{ print $6, $2 }' | LC_ALL=C sort -k1,1; }
MISMATCHES=$(LC_ALL=C join <(list_owners rootfs.tar.gz) <(list_owners patched/rootfs.tar.gz) | awk '$2 != $3' || true)
if [ -n "$MISMATCHES" ]; then
    echo "$MISMATCHES" | head -20
    die "file owners changed in the patched image (see above) - not copying it to the SD card"
fi
echo "✓ All original file owners preserved"

echo "Step 10: Cleaning up..."
rm -rf ./extract

if [ "$MOVE_TO_SD_CARD" = true ]; then
    echo "Copying to SD Card"
    [ -d "$SD_CARD_TARGET" ] || die "$SD_CARD_TARGET not found - is the SD card partition A mounted?"
    cp patched/rootfs.tar.gz "$SD_CARD_TARGET/rootfs.tar.gz"
    sync
    cmp -s patched/rootfs.tar.gz "$SD_CARD_TARGET/rootfs.tar.gz" || die "copy on SD card doesn't match patched/rootfs.tar.gz"
    echo "Modification complete! Unmount the SD card and put it back into your Eight Sleep Pod."
else
    echo "Done! Patched rootfs is in patched/rootfs.tar.gz"
fi
echo ""
echo "Next:"
echo "  1. Hold the small button on the back while plugging the pod in (light flashes green = reflashing)."
echo "  2. Clear the old host key:  ssh-keygen -R \"[<pod-ip>]:8822\""
echo "  3. SSH in:                  ssh rewt@<pod-ip> -p 8822   (or root@ if ALLOW_ROOT_SSH=true)"
