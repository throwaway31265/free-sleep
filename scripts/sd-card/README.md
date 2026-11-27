# Pod 3 (with SD card): patch the factory image

`patch_factory_image.sh` edits the factory image that a Pod 3 restores during a factory reset
(`opt/images/Yocto/rootfs.tar.gz` on its SD card). After you put the card back and reset the Pod, it:

- joins your Wi-Fi,
- accepts SSH on port 8822 as `rewt` with your key,
- has Eight Sleep's firmware updater and cloud services disabled,

so you can go straight to installing free-sleep. No JTAG/serial cable is needed.

It runs on a **Linux PC or WSL**, not on the Pod. It only applies to the **Pod 3 with an SD card**
(not the Pod 3 with FCC ID 2AYXT61100001, Pod 4 or Pod 5). It has been tested with the 2021 factory
image (Yocto 3.3 "hardknott").

## Read this first

- **The Pod stops working with the Eight Sleep app** after the reset, until free-sleep is installed.
  The script masks `dac.service`, `frankenfirmware.service`, the updater and the telemetry services
  ([INSTALLATION.md](../../INSTALLATION.md) step 11).
- **It changes how you log in:** new passwords for `root` and `rewt`, your SSH key, and passwordless
  `sudo` for `rewt`. By default only key login as `rewt` is allowed over SSH.
- **The SD card's factory image is your recovery path.** Keep the original `rootfs.tar.gz`. The script
  never overwrites the card's image in place: it verifies the new image, saves a backup on the card when
  there is room, and swaps the files only after the copy read back from the card checks out. A bad image can still leave the Pod
  unable to boot until you restore the original (see [Restore](#restore-the-original-image)).
- Opening the Pod and changing its firmware may void the warranty. You do this at your own risk.

## 1. Get the SD card out

Open the hub as in the [Pod 3 teardown photos](../../docs/pod_3_teardown) (fan/grill off, lid off).
The microSD card is on the main board. Note its orientation before removing it.

## 2. Copy the factory image off the card

The card has several partitions. You need the ext4 partition that contains `opt/images/Yocto/rootfs.tar.gz`.

**Linux:** insert the card and find its partitions:

```bash
lsblk -f                      # e.g. /dev/sdb with partitions sdb1, sdb2, ...
sudo mkdir -p /mnt/podsd
sudo mount /dev/sdb1 /mnt/podsd    # try each ext4 partition until this exists:
ls /mnt/podsd/opt/images/Yocto/rootfs.tar.gz
```

**Windows (WSL 2):** WSL does not see card readers by default. Either attach the reader to WSL with
[usbipd-win](https://learn.microsoft.com/windows/wsl/connect-usb) and then follow the Linux steps, or,
if the reader shows up as a physical disk, mount the partition from an admin PowerShell:

```powershell
GET-CimInstance -query "SELECT * from Win32_DiskDrive"      # find \\.\PHYSICALDRIVE<n>
wsl --mount \\.\PHYSICALDRIVE<n> --partition <p>            # appears under /mnt/wsl/PHYSICALDRIVE<n>p<p>
```

Then copy the image to a folder on the **Linux** filesystem (not `/mnt/c`, which cannot store Linux
file owners), and keep a separate backup:

```bash
mkdir -p ~/pod-image && cd ~/pod-image
cp /mnt/podsd/opt/images/Yocto/rootfs.tar.gz .
cp rootfs.tar.gz ~/rootfs.tar.gz.factory-backup
```

## 3. Configure

```bash
sudo apt install -y tar gzip openssl openssh-client wpasupplicant util-linux
cd /path/to/free-sleep/scripts/sd-card
cp sd-card.env.example sd-card.env          # sd-card.env is ignored by git
nano sd-card.env
```

| Setting | Default | What it does |
|---|---|---|
| `WIFI_SSID`, `WIFI_PASSWORD` | (required) | 2.4 GHz WPA2-Personal network. Only the derived key is stored in the image, not the passphrase. |
| `ROOT_PASSWORD` | (required) | New password for `root` and `rewt` (SHA-512 hashed). |
| `SSH_PUBLIC_KEY_FILE` | `~/.ssh/id_ed25519.pub` | Your public key, installed as `/etc/ssh/authorized_keys`. Private keys are rejected. |
| `ALLOW_ROOT_SSH` | `false` | Also allow `root` over SSH (stock firmware allows only `rewt`). |
| `ALLOW_PASSWORD_SSH` | `false` | Also allow password login over SSH. |
| `KEEP_EXISTING_AUTHORIZED_KEYS` | `false` | Keep any keys already in the image instead of replacing them. |
| `REWT_PASSWORDLESS_SUDO` | `true` | `rewt` can use `sudo` without a password. |
| `MASK_UPDATE_SERVICES` | `true` | Disable the updater and cloud services. Leave on, or the Pod updates itself and the changes are lost. |

Leave `WIFI_PASSWORD` or `ROOT_PASSWORD` empty to be prompted for them instead (better than storing
them in the file). `~` and `$HOME` in settings mean your own home folder, even though the script runs
with `sudo`.

## 4. Patch the image

From the folder holding your copy of `rootfs.tar.gz`:

```bash
cd ~/pod-image
sudo /path/to/free-sleep/scripts/sd-card/patch_factory_image.sh
```

This writes `~/pod-image/patched/rootfs.tar.gz` and doesn't touch the card. Before writing it, the
script checks that every file in the original image still has the same owner, mode and link target
(only the files it intentionally adds or edits may differ), and that the result is a valid archive.

To also install it to the card, pass the card's `opt/images/Yocto` folder:

```bash
sudo /path/to/free-sleep/scripts/sd-card/patch_factory_image.sh --sd-target /mnt/podsd/opt/images/Yocto
sync && sudo umount /mnt/podsd
```

Other options: `--image FILE` (patch a different file), `--config FILE` (use another settings file).

`patched/rootfs.tar.gz` contains your Wi-Fi key and password hashes. Delete it once the card is done.

## 5. Reset the Pod and log in

1. Put the card back, close the hub, and do a firmware reset: hold the button on the back while
   plugging the Pod in ([photo](../../docs/pod_3_teardown/6_firmware_reset.jpeg)). It reflashes
   itself from the card and reboots, which takes several minutes.
2. Find the Pod's IP address in your router's list of DHCP clients.
3. Log in:
   ```bash
   ssh-keygen -R "[<pod-ip>]:8822"
   ssh rewt@<pod-ip> -p 8822
   ```
4. Continue with [INSTALLATION.md](../../INSTALLATION.md) step 13 (install free-sleep). Steps 11 and 12
   (disable updates, set up Wi-Fi) are already done. If you later run step 18 (`setup_ssh.sh`), it
   replaces this SSH setup, so have your key ready.

If the Pod doesn't show up on your network, check the Wi-Fi name and password (2.4 GHz only), then
re-run the script and reflash.

## Restore the original image

Put your untouched image back on the card and do another firmware reset:

```bash
# The script's backup on the card, if it made one:
sudo mv /mnt/podsd/opt/images/Yocto/rootfs.tar.gz.orig /mnt/podsd/opt/images/Yocto/rootfs.tar.gz
# or your own backup:
sudo cp ~/rootfs.tar.gz.factory-backup /mnt/podsd/opt/images/Yocto/rootfs.tar.gz
sync && sudo umount /mnt/podsd
```

## Credits

Patching the factory image this way was first shared by Pixel-Meister in
[freesleep_script](https://github.com/Pixel-Meister/freesleep_script). This is a separate
implementation that adds input validation, ownership verification and a safe install to the card.
