#!/bin/bash
# Patch a Pod 3 factory image (rootfs.tar.gz from the SD card) so that, after a factory
# reset, the Pod joins your Wi-Fi with SSH access and Eight Sleep's updater disabled.
#
# Runs on a Linux PC or WSL (NOT on the Pod). See README.md in this folder before using it.
#
# Usage:
#   sudo ./patch_factory_image.sh [--config FILE] [--image FILE] [--sd-target DIR]
#
#   --config FILE    Settings file (default: sd-card.env next to this script). See sd-card.env.example.
#   --image FILE     Original factory image to patch (default: ./rootfs.tar.gz).
#   --sd-target DIR  Also install the result to the SD card. DIR is the mounted card's
#                    opt/images/Yocto folder. Without it, the result is only written to
#                    ./patched/rootfs.tar.gz and the card is not touched.

set -euo pipefail
umask 077   # every file this script creates (work files, the patched image) is private to root

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/sd-card.env"
INPUT_IMAGE="./rootfs.tar.gz"
SD_TARGET=""
OUTPUT_DIR="./patched"
OUTPUT_IMAGE="$OUTPUT_DIR/rootfs.tar.gz"

# Eight Sleep services that update the firmware or talk to their cloud (same list as INSTALLATION.md step 11)
UPDATE_UNITS=(swupdate-progress.service swupdate.service defibrillator.service eight-kernel.service
              telegraf.service vector.service frankenfirmware.service dac.service swupdate.socket)

die() { echo "Error: $*" >&2; exit 1; }
info() { echo "==> $*"; }
ok() { echo "    ok: $*"; }

usage() { sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

while [ $# -gt 0 ]; do
    case "$1" in
        --config) CONFIG_FILE="${2:?--config needs a file}"; shift 2 ;;
        --image) INPUT_IMAGE="${2:?--image needs a file}"; shift 2 ;;
        --sd-target) SD_TARGET="${2:?--sd-target needs a directory}"; shift 2 ;;
        -h|--help) usage 0 ;;
        *) echo "Unknown argument: $1" >&2; usage 1 ;;
    esac
done

# ------------------------------------------------------------------------------
# Settings: environment variables, overridden by the config file; missing secrets are prompted for.
# Under sudo, $HOME and ~ in settings mean the home of the user who ran sudo, not /root.
INVOKING_HOME="$HOME"
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != root ]; then
    INVOKING_HOME="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
    [ -n "$INVOKING_HOME" ] || INVOKING_HOME="$HOME"
fi

WIFI_SSID="${WIFI_SSID:-}"
WIFI_PASSWORD="${WIFI_PASSWORD:-}"
ROOT_PASSWORD="${ROOT_PASSWORD:-}"
SSH_PUBLIC_KEY_FILE="${SSH_PUBLIC_KEY_FILE:-}"
ALLOW_ROOT_SSH="${ALLOW_ROOT_SSH:-false}"
ALLOW_PASSWORD_SSH="${ALLOW_PASSWORD_SSH:-false}"
KEEP_EXISTING_AUTHORIZED_KEYS="${KEEP_EXISTING_AUTHORIZED_KEYS:-false}"
REWT_PASSWORDLESS_SUDO="${REWT_PASSWORDLESS_SUDO:-true}"
MASK_UPDATE_SERVICES="${MASK_UPDATE_SERVICES:-true}"

if [ -f "$CONFIG_FILE" ]; then
    root_home="$HOME"
    HOME="$INVOKING_HOME"
    # shellcheck source=/dev/null
    . "$CONFIG_FILE"
    HOME="$root_home"
    info "Loaded settings from $CONFIG_FILE"
fi

prompt_secret() {
    # prompt_secret VAR "Label": read a value without echoing it, unless VAR is already set
    local var_name="$1" label="$2" value
    [ -n "${!var_name}" ] && return 0
    [ -t 0 ] || die "$var_name is not set (set it in $CONFIG_FILE or the environment)"
    IFS= read -r -s -p "$label: " value; echo
    printf -v "$var_name" '%s' "$value"
}

[ -n "$WIFI_SSID" ] || { [ -t 0 ] && IFS= read -r -p "Wi-Fi network name (2.4 GHz): " WIFI_SSID; }
prompt_secret WIFI_PASSWORD "Wi-Fi password"
prompt_secret ROOT_PASSWORD "New password for root and rewt"
[ -n "$SSH_PUBLIC_KEY_FILE" ] || { [ -t 0 ] && read -r -p "Path to your SSH public key (.pub): " SSH_PUBLIC_KEY_FILE; }

is_bool() { [ "$1" = true ] || [ "$1" = false ]; }
for flag in ALLOW_ROOT_SSH ALLOW_PASSWORD_SSH KEEP_EXISTING_AUTHORIZED_KEYS REWT_PASSWORDLESS_SUDO MASK_UPDATE_SERVICES; do
    is_bool "${!flag}" || die "$flag must be true or false (got '${!flag}')"
done

# ------------------------------------------------------------------------------
# Pre-flight checks (all before anything is extracted or written)

info "Checking settings and tools"

# tar must run as root to restore every file's original owner (dac, rewt, messagebus, ...).
# A repack without them makes everything root-owned, which breaks the free-sleep installer.
[ "$(id -u)" -eq 0 ] || die "run with sudo"

# Windows drives under WSL (/mnt/c, ...) cannot store Linux owners, modes or symlinks.
case "$(pwd -P)" in
    /mnt/[a-zA-Z]|/mnt/[a-zA-Z]/*) die "run from a folder on the Linux filesystem (e.g. ~/pod-image), not $(pwd -P)" ;;
esac

for cmd in tar gzip openssl ssh-keygen wpa_passphrase cmp df findmnt; do
    command -v "$cmd" >/dev/null || die "'$cmd' is missing (Debian/Ubuntu: sudo apt install -y tar gzip openssl openssh-client wpasupplicant util-linux)"
done

[ -f "$INPUT_IMAGE" ] || die "factory image not found: $INPUT_IMAGE (copy rootfs.tar.gz off the SD card first, see README.md)"
gzip -t "$INPUT_IMAGE" || die "$INPUT_IMAGE is not a valid gzip file"

for placeholder in YOUR_WIFI_SSID YOUR_WIFI_PASSWORD CHANGE_ME; do
    for value in "$WIFI_SSID" "$WIFI_PASSWORD" "$ROOT_PASSWORD"; do
        [ "$value" != "$placeholder" ] || die "replace the placeholder '$placeholder' in $CONFIG_FILE"
    done
done

[ -n "$WIFI_SSID" ] || die "WIFI_SSID is empty"
ssid_bytes=$(printf '%s' "$WIFI_SSID" | wc -c)
[ "$ssid_bytes" -le 32 ] || die "WIFI_SSID is longer than 32 bytes"
# Counted in bytes: wpa_passphrase silently cuts longer input, which would derive the wrong key
password_bytes=$(printf '%s' "$WIFI_PASSWORD" | LC_ALL=C wc -c)
[ "$password_bytes" -ge 8 ] && [ "$password_bytes" -le 63 ] \
    || die "WIFI_PASSWORD must be 8-63 characters (bytes; WPA2-Personal passphrase)"
[ -n "$ROOT_PASSWORD" ] || die "ROOT_PASSWORD is empty"

[ -n "$SSH_PUBLIC_KEY_FILE" ] || die "SSH_PUBLIC_KEY_FILE is empty"
SSH_PUBLIC_KEY_FILE="${SSH_PUBLIC_KEY_FILE/#\~/$INVOKING_HOME}"
[ -f "$SSH_PUBLIC_KEY_FILE" ] || die "SSH public key not found: $SSH_PUBLIC_KEY_FILE"
if grep -q "PRIVATE KEY" "$SSH_PUBLIC_KEY_FILE"; then
    die "$SSH_PUBLIC_KEY_FILE is a PRIVATE key. Use the matching .pub file"
fi
SSH_PUBLIC_KEY="$(grep -E '^(ssh-|ecdsa-|sk-)' "$SSH_PUBLIC_KEY_FILE" | head -n 1 || true)"
[ -n "$SSH_PUBLIC_KEY" ] || die "$SSH_PUBLIC_KEY_FILE does not contain an OpenSSH public key line"
printf '%s\n' "$SSH_PUBLIC_KEY" | ssh-keygen -l -f - >/dev/null 2>&1 || die "$SSH_PUBLIC_KEY_FILE is not a valid public key"
ok "SSH key $(printf '%s\n' "$SSH_PUBLIC_KEY" | ssh-keygen -l -f - | awk '{print $1, $2, $NF}')"

if [ "$ALLOW_ROOT_SSH" = false ] && [ "$ALLOW_PASSWORD_SSH" = false ]; then
    ok "SSH: key login as rewt only"
fi

# wpa_passphrase prints the derived 256-bit key as psk=<64 hex>; the plaintext passphrase never enters the image
wpa_output="$(printf '%s\n' "$WIFI_PASSWORD" | wpa_passphrase "$WIFI_SSID" 2>&1)" \
    || die "wpa_passphrase rejected the Wi-Fi settings: $(printf '%s\n' "$wpa_output" | grep -v 'psk=' | head -n 3)"
HEX_PSK="$(printf '%s\n' "$wpa_output" | sed -n 's/^[[:space:]]*psk=\([0-9a-f]\{64\}\)$/\1/p')"
unset wpa_output
[ -n "$HEX_PSK" ] || die "could not derive the Wi-Fi key with wpa_passphrase"

if [ -n "$SD_TARGET" ]; then
    SD_TARGET="${SD_TARGET%/}"
    [ -f "$SD_TARGET/rootfs.tar.gz" ] || die "$SD_TARGET/rootfs.tar.gz not found (is the SD card mounted, and is this its opt/images/Yocto folder?)"
    sd_mount="$(findmnt -n -o TARGET -T "$SD_TARGET")"
    [ "$sd_mount" != "/" ] || die "$SD_TARGET is on the root filesystem, not a mounted SD card"
    ok "SD card mounted at $sd_mount"
fi

# ------------------------------------------------------------------------------
# Work area, removed on exit (it holds the patched shadow file and Wi-Fi key)

WORK_DIR="$(mktemp -d "$(pwd -P)/.pod-image.XXXXXX")"
ROOTFS="$WORK_DIR/rootfs"
# Partial files written to the SD card; removed on exit so a failed copy never leaves one behind
CARD_TEMP_FILES=()
cleanup() { rm -rf "$WORK_DIR"; [ ${#CARD_TEMP_FILES[@]} -eq 0 ] || rm -f "${CARD_TEMP_FILES[@]}"; }
trap cleanup EXIT
mkdir -p "$ROOTFS"

# Paths (relative to the image root, without a leading ./) this script creates or edits. They are
# excluded from the owner/mode comparison; everything else must be unchanged.
CHANGED_PATHS=()
mark_changed() { CHANGED_PATHS+=("${1#"$ROOTFS"/}"); }

# Create a directory inside the image if missing, recording it as an intended change.
ensure_dir() {
    local dir="$1"
    [ -d "$dir" ] && return 0
    ensure_dir "$(dirname "$dir")"
    mkdir "$dir"
    chown 0:0 "$dir"
    chmod 755 "$dir"
    mark_changed "$dir"
}

# Refuse to edit a path that is a symlink or resolves outside the extracted image. This script runs
# as root on the host, so writing through an absolute link in the image would change the host's file.
require_inside_image() {
    local path="$1" resolved
    [ ! -L "$path" ] || die "${path#"$ROOTFS"} is a symlink in the image; refusing to edit through it"
    resolved="$(realpath -m -- "$path")"
    case "$resolved" in
        "$ROOTFS"/*) ;;
        *) die "${path#"$ROOTFS"} resolves outside the image ($resolved)" ;;
    esac
}

TAR_META=(--numeric-owner --xattrs --xattrs-include='*' --acls)

info "Extracting $INPUT_IMAGE"
tar "${TAR_META[@]}" --same-owner --same-permissions -xzf "$INPUT_IMAGE" -C "$ROOTFS"

# Make sure this is a Pod 3 Yocto root filesystem before editing anything
for required in etc/os-release etc/shadow etc/ssh/sshd_config etc/NetworkManager; do
    [ -e "$ROOTFS/$required" ] || die "$required not found in the image. Is this a Pod 3 factory rootfs.tar.gz?"
done
# Parsed rather than sourced: the image's files must never run as code on the host
image_os="$(sed -n 's/^PRETTY_NAME=//p' "$ROOTFS/etc/os-release" | head -n 1 | tr -d "\"'")"
ok "Image OS: ${image_os:-unknown}"
grep -q '^root:' "$ROOTFS/etc/shadow" || die "no root user in the image's /etc/shadow"
grep -q '^rewt:' "$ROOTFS/etc/shadow" || die "no rewt user in the image's /etc/shadow"

# ------------------------------------------------------------------------------
info "Setting the root and rewt passwords"
# SHA-512 crypt with a random salt per user (the Pod's libcrypt supports \$6\$)
require_inside_image "$ROOTFS/etc/shadow"
for user in root rewt; do
    # The hash goes to awk through the environment, not its command line (visible in the process list)
    PASSWORD_HASH="$(printf '%s\n' "$ROOT_PASSWORD" | openssl passwd -6 -stdin)" \
        awk -v user="$user" 'BEGIN { FS = OFS = ":" } $1 == user { $2 = ENVIRON["PASSWORD_HASH"] } { print }' \
        "$ROOTFS/etc/shadow" > "$WORK_DIR/shadow.new"
    cat "$WORK_DIR/shadow.new" > "$ROOTFS/etc/shadow"   # keep the original file's owner and mode
    grep -q "^$user:\\\$6\\\$" "$ROOTFS/etc/shadow" || die "failed to set the $user password"
done
rm -f "$WORK_DIR/shadow.new"
mark_changed "$ROOTFS/etc/shadow"
ok "root and rewt"

# ------------------------------------------------------------------------------
info "Adding the Wi-Fi profile"
# NetworkManager reads keyfiles from /etc/NetworkManager/system-connections unless [keyfile] path= says otherwise
keyfile_dir="$(grep -hs '^[[:space:]]*path[[:space:]]*=' "$ROOTFS/etc/NetworkManager/NetworkManager.conf" \
    "$ROOTFS"/etc/NetworkManager/conf.d/*.conf 2>/dev/null | tail -n 1 | sed 's/^[^=]*=[[:space:]]*//' || true)"
keyfile_dir="${keyfile_dir:-/etc/NetworkManager/system-connections}"
case "$keyfile_dir" in
    /etc/*) ;;
    *) die "this image keeps Wi-Fi profiles in $keyfile_dir (outside /etc), which this script does not support" ;;
esac
require_inside_image "$ROOTFS$keyfile_dir"
ensure_dir "$ROOTFS$keyfile_dir"

# The SSID is written as a list of byte values so that spaces, ';' or '\' cannot break the keyfile syntax
ssid_byte_list="$(printf '%s' "$WIFI_SSID" | od -An -tu1 -v | tr -s ' \n' ';' | sed 's/^;//')"
connection_uuid="$(cat /proc/sys/kernel/random/uuid)"
wifi_profile="$ROOTFS$keyfile_dir/free-sleep-wifi.nmconnection"
require_inside_image "$wifi_profile"
cat > "$wifi_profile" <<EOF
[connection]
id=free-sleep-wifi
uuid=$connection_uuid
type=802-11-wireless
interface-name=wlan0
autoconnect=true

[802-11-wireless]
mode=infrastructure
ssid=$ssid_byte_list

[802-11-wireless-security]
key-mgmt=wpa-psk
psk=$HEX_PSK

[ipv4]
method=auto

[ipv6]
addr-gen-mode=stable-privacy
method=auto
EOF
chown 0:0 "$wifi_profile"
chmod 600 "$wifi_profile"
mark_changed "$wifi_profile"
ok "${keyfile_dir}/free-sleep-wifi.nmconnection"

# ------------------------------------------------------------------------------
info "Configuring SSH"

set_sshd_option() {
    # set_sshd_option FILE KEY VALUE: replace the first (possibly commented) KEY line in the global
    # section, or insert one before the first "Match" block (lines after Match only apply to that block)
    local file="$1" key="$2" value="$3"
    awk -v key="$key" -v value="$value" '
        /^[[:space:]]*Match[[:space:]]/ { in_match = 1 }
        !done && !in_match && $0 ~ "^[#[:space:]]*" key "([[:space:]]|$)" { print key " " value; done = 1; next }
        !done && in_match { print key " " value; done = 1 }
        { print }
        END { if (!done) print key " " value }' "$file" > "$file.new"
    cat "$file.new" > "$file"   # keep the original file's owner and mode
    rm -f "$file.new"
    grep -Eq "^${key}[[:space:]]+${value}\$" "$file" || die "failed to set $key in ${file#"$ROOTFS"}"
}

sshd_configs=()
for candidate in etc/ssh/sshd_config etc/ssh/sshd_config_readonly; do
    [ -f "$ROOTFS/$candidate" ] && sshd_configs+=("$ROOTFS/$candidate")
done

for config in "${sshd_configs[@]}"; do
    require_inside_image "$config"
    set_sshd_option "$config" PubkeyAuthentication yes
    if [ "$ALLOW_ROOT_SSH" = true ]; then
        set_sshd_option "$config" PermitRootLogin yes
        # Stock firmware has "AllowUsers rewt", which blocks root regardless of PermitRootLogin
        if grep -q '^AllowUsers' "$config" && ! grep -Eq '^AllowUsers.*[[:space:]]root([[:space:]]|$)' "$config"; then
            sed -i '/^AllowUsers/ s/$/ root/' "$config"
        fi
    fi
    if [ "$ALLOW_PASSWORD_SSH" = true ]; then
        set_sshd_option "$config" PasswordAuthentication yes
    else
        set_sshd_option "$config" PasswordAuthentication no
    fi
    mark_changed "$config"
    ok "${config#"$ROOTFS"}: $(grep -E '^(Port|AllowUsers)' "$config" | tr '\n' ' ')"
done

# Install the key where the image's sshd actually looks for it
# sshd keywords are case-insensitive and may be separated from their values by tabs.
authorized_keys_setting="$(awk 'tolower($1) == "authorizedkeysfile" { $1 = ""; print; exit }' "$ROOTFS/etc/ssh/sshd_config")"
case " $authorized_keys_setting " in
    *" /etc/ssh/authorized_keys "*) ;;
    *) die "the image's sshd does not read /etc/ssh/authorized_keys (AuthorizedKeysFile: '${authorized_keys_setting:-default}')" ;;
esac
authorized_keys="$ROOTFS/etc/ssh/authorized_keys"
require_inside_image "$authorized_keys"
if [ "$KEEP_EXISTING_AUTHORIZED_KEYS" = true ] && [ -f "$authorized_keys" ]; then
    # Start on a new line even if the existing file does not end with one
    if [ -s "$authorized_keys" ] && [ -n "$(tail -c 1 "$authorized_keys")" ]; then
        echo >> "$authorized_keys"
    fi
    printf '%s\n' "$SSH_PUBLIC_KEY" >> "$authorized_keys"
else
    printf '%s\n' "$SSH_PUBLIC_KEY" > "$authorized_keys"
fi
chown 0:0 "$authorized_keys"
chmod 644 "$authorized_keys"
mark_changed "$authorized_keys"
ok "/etc/ssh/authorized_keys"

# ------------------------------------------------------------------------------
if [ "$REWT_PASSWORDLESS_SUDO" = true ]; then
    info "Allowing rewt to use sudo without a password"
    ensure_dir "$ROOTFS/etc/sudoers.d"
    sudoers_file="$ROOTFS/etc/sudoers.d/010-free-sleep-rewt"
    require_inside_image "$sudoers_file"
    echo 'rewt ALL=(ALL:ALL) NOPASSWD: ALL' > "$sudoers_file"
    chown 0:0 "$sudoers_file"
    chmod 440 "$sudoers_file"
    if command -v visudo >/dev/null; then
        visudo -cqf "$sudoers_file" || die "generated sudoers file is invalid"
    fi
    mark_changed "$sudoers_file"
    ok "/etc/sudoers.d/010-free-sleep-rewt"
fi

if [ "$MASK_UPDATE_SERVICES" = true ]; then
    info "Masking Eight Sleep's update and cloud services"
    # Equivalent to "systemctl mask": a unit linked to /dev/null in /etc/systemd/system cannot start
    require_inside_image "$ROOTFS/etc/systemd/system"
    ensure_dir "$ROOTFS/etc/systemd/system"
    for unit in "${UPDATE_UNITS[@]}"; do
        ln -sfn /dev/null "$ROOTFS/etc/systemd/system/$unit"
        mark_changed "$ROOTFS/etc/systemd/system/$unit"
    done
    ok "${UPDATE_UNITS[*]}"
fi

# ------------------------------------------------------------------------------
info "Packing the patched image"
mkdir -p "$OUTPUT_DIR"
tar "${TAR_META[@]}" -czf "$WORK_DIR/rootfs.tar.gz" -C "$ROOTFS" .
gzip -t "$WORK_DIR/rootfs.tar.gz" || die "the packed image failed its gzip check"

info "Verifying the patched image against the original"
# List "path<TAB>mode<TAB>owner/group<TAB>link target" for every entry, without any leading ./ so
# both archives compare by the same key. The path is everything after the date/time columns (so
# spaces survive); symlinks ("name -> target") and hard links ("name link to target") are split.
# tar stores whichever hard-link member it meets first as the file and the others as links to it,
# and that can change on repack. So every member of a hard-link group is listed as a regular file
# labelled with the group (its alphabetically first path): leaving or joining a group still shows.
list_entries() {
    tar --numeric-owner -tvzf "$1" | awk '
        function find_group(member) { while ((member in parent) && parent[member] != member) member = parent[member]; return member }
        function join_group(first, second,    root_first, root_second) {
            linked[first] = 1; linked[second] = 1
            root_first = find_group(first); root_second = find_group(second)
            if (root_first == root_second) return
            if (root_first < root_second) parent[root_second] = root_first; else parent[root_first] = root_second }
        { path = $0; target = ""
          for (field = 1; field <= 5; field++) sub(/^[^ ]+ +/, "", path)
          if ($1 ~ /^l/ && index(path, " -> ")) { target = substr(path, index(path, " -> ") + 4); path = substr(path, 1, index(path, " -> ") - 1) }
          else if (index(path, " link to ")) { target = substr(path, index(path, " link to ") + 9); path = substr(path, 1, index(path, " link to ") - 1) }
          sub(/^\.\//, "", path); sub(/\/$/, "", path); sub(/^\.\//, "", target)
          if (path == "." || path == "") next
          count++; paths[count] = path; modes[count] = $1; owners[count] = $2; targets[count] = target
          if ($1 ~ /^h/) join_group(path, target) }
        END {
          for (entry = 1; entry <= count; entry++) {
              mode = modes[entry]; target = targets[entry]
              if (paths[entry] in linked) { sub(/^h/, "-", mode); target = "hardlink-group:" find_group(paths[entry]) }
              print paths[entry] "\t" mode "\t" owners[entry] "\t" target } }' | LC_ALL=C sort -u
}
printf '%s\n' "${CHANGED_PATHS[@]}" | LC_ALL=C sort -u > "$WORK_DIR/changed"
without_changed() { awk -F'\t' 'NR == FNR { skip[$0] = 1; next } !($1 in skip)' "$WORK_DIR/changed" "$1"; }

list_entries "$INPUT_IMAGE" > "$WORK_DIR/original.list"
list_entries "$WORK_DIR/rootfs.tar.gz" > "$WORK_DIR/patched.list"
original_count=$(wc -l < "$WORK_DIR/original.list")
[ "$original_count" -gt 1000 ] || die "only $original_count entries listed in the original image; refusing to trust the comparison"

# Any entry missing, added or changed (mode, owner, link target) outside the intended changes fails the check
differences="$(LC_ALL=C comm -3 <(without_changed "$WORK_DIR/original.list") <(without_changed "$WORK_DIR/patched.list"))"
if [ -n "$differences" ]; then
    printf '%s\n' "$differences" | head -n 20
    die "the patched image differs from the original outside the intended changes (path, mode, owner or link; see above)"
fi
ok "$original_count original entries keep their owner and mode; ${#CHANGED_PATHS[@]} intended changes"

mv -f "$WORK_DIR/rootfs.tar.gz" "$OUTPUT_IMAGE"
chmod 600 "$OUTPUT_IMAGE"
ok "wrote $OUTPUT_IMAGE (it contains your Wi-Fi key and password hashes; delete it when done)"

# ------------------------------------------------------------------------------
if [ -n "$SD_TARGET" ]; then
    info "Installing to the SD card ($SD_TARGET)"
    card_image="$SD_TARGET/rootfs.tar.gz"
    card_backup="$SD_TARGET/rootfs.tar.gz.orig"
    patched_kib=$(( ($(stat -c %s "$OUTPUT_IMAGE") + 1023) / 1024 ))
    original_kib=$(( ($(stat -c %s "$card_image") + 1023) / 1024 ))
    free_kib=$(df --output=avail -k "$SD_TARGET" | tail -n 1 | tr -d ' ')

    # Compare a file just written to the card with a known-good source. sync alone leaves the written
    # pages cached in RAM, so drop the cache first to make cmp read back what the card actually stored
    # (cheap cards can silently lose writes).
    verify_card_copy() {
        local source="$1" copy="$2"
        sync
        if ! { echo 1 > /proc/sys/vm/drop_caches; } 2>/dev/null; then
            dd if="$copy" iflag=nocache count=0 status=none 2>/dev/null || true
        fi
        cmp -s "$source" "$copy" && gzip -t "$copy" 2>/dev/null
    }

    if [ -f "$card_backup" ]; then
        gzip -t "$card_backup" 2>/dev/null || die "the existing backup $card_backup is not a valid image; fix or remove it first"
        ok "backup already on the card: rootfs.tar.gz.orig"
    elif cmp -s "$card_image" "$INPUT_IMAGE"; then
        # Keep the untouched factory image next to the patched one when there is room
        if [ "$free_kib" -gt $((patched_kib + original_kib + 1024)) ]; then
            CARD_TEMP_FILES+=("$card_backup.tmp")
            if ! { cp "$card_image" "$card_backup.tmp" && chmod --reference="$card_image" "$card_backup.tmp" \
                    && verify_card_copy "$INPUT_IMAGE" "$card_backup.tmp"; }; then
                die "could not back up the original image on the card"
            fi
            mv -f "$card_backup.tmp" "$card_backup"
            free_kib=$((free_kib - original_kib))
            ok "backed up the original image to rootfs.tar.gz.orig on the card"
        else
            echo "    note: not enough room for a backup on the card; your copy $INPUT_IMAGE is the backup. Keep it."
        fi
    else
        die "the card's rootfs.tar.gz is not the image you patched ($INPUT_IMAGE) and there is no rootfs.tar.gz.orig. Copy the card's image first."
    fi

    [ "$free_kib" -gt $((patched_kib + 1024)) ] || die "not enough free space on the card for the patched image (${patched_kib} KiB needed)"

    # Write next to the original, verify, then swap with a rename so an interruption never leaves a truncated image
    CARD_TEMP_FILES+=("$card_image.new")
    cp "$OUTPUT_IMAGE" "$card_image.new"
    chmod --reference="$card_image" "$card_image.new"   # same mode as the factory image on the card
    verify_card_copy "$OUTPUT_IMAGE" "$card_image.new" || die "the copy on the card does not match; card left unchanged"
    mv -f "$card_image.new" "$card_image"
    sync
    ok "installed. Unmount the card (sudo umount $sd_mount) before removing it"
fi

echo
echo "Done. Next steps (see README.md):"
echo "  1. Put the SD card back and factory-reset the Pod (hold the button on the back while plugging it in)."
echo "  2. Find the Pod's IP in your router's DHCP list, then:  ssh-keygen -R \"[<pod-ip>]:8822\""
echo "  3. ssh rewt@<pod-ip> -p 8822"
echo "  4. Continue with INSTALLATION.md step 13 (install free-sleep)."
