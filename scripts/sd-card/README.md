# SD card firmware patch (Pod 3)

`modify_eight_sleep.sh` patches the Pod's factory image (`/opt/images/Yocto/rootfs.tar.gz` on SD card partition A)
so that, after a factory reset, the Pod comes up with SSH access and Wi-Fi already configured.

## What it changes in the image

| Change | Setting |
|---|---|
| Sets the `root` and `rewt` passwords | `ROOT_PASSWORD` |
| Adds a NetworkManager Wi-Fi profile (2.4 GHz, WPA2-Personal) | `WIFI_SSID`, `WIFI_PASSWORD` |
| Installs your SSH public key in `/etc/ssh/authorized_keys` (validated with `ssh-keygen` first) | `SSH_KEY` |
| Enables password login and root login, and adds `root` to `AllowUsers` (stock firmware only allows `rewt`) | `ALLOW_ROOT_SSH` |
| Passwordless sudo for `rewt` | `REWT_PASSWORDLESS_SUDO` |
| Masks Eight Sleep's update/cloud services (same list as [INSTALLATION.md](../../INSTALLATION.md)) | `MASK_UPDATE_SERVICES` |

Every file keeps its original owner and permissions. The script compares owners against the original image and refuses
to copy to the SD card if anything changed. Losing ownership (for example, `/home/dac` becoming root-owned) breaks the
free-sleep installer.

## Usage

Run on Linux or WSL, from a folder on the Linux filesystem (not `/mnt/c`):

```bash
sudo apt install -y wpasupplicant openssl openssh-client
mkdir -p ~/freesleep && cd ~/freesleep
cp /mnt/part1/opt/images/Yocto/rootfs.tar.gz .        # partition A of the SD card
cp rootfs.tar.gz ~/rootfs.tar.gz.orig                 # keep a backup
# copy modify_eight_sleep.sh here and edit the Configuration section
sudo bash ./modify_eight_sleep.sh
```

Then put the card back, hold the small button on the back of the Pod while plugging it in (the light flashes green),
and SSH in once it has rebooted: `ssh rewt@<pod-ip> -p 8822`.

> The script holds your Wi-Fi and root passwords. Don't commit your filled-in copy.
