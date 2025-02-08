# REQUIREMENTS

## Compatability
- Pod 3 - FCC ID: 2AYXT61100001 (The FCC ID is located in the back of the pod where you plug in the water tubes)
- Pod 4


## Tools required
- [TC2070-IDC ($50)](https://www.tag-connect.com/product/tc2070-idc)
- [FTDI FT232RL ($13)](https://www.amazon.com/gp/product/B07TXVRQ7V/)
- [Dupont wires ($7)](https://www.amazon.com/Elegoo-EL-CP-004-Multicolored-Breadboard-arduino/dp/B01EV70C78)
- PSA - The instructions contained here are specific to mac and linux. If you have Windows, you'll have to figure that out yourself (it's do-able, I just refuse to use Windows)

---

## How to revert changes and go back to using your Eight Sleep through their app
1. If you already had your pod added to your 8 sleep account in your app, go to your 8 sleep app and manage your pod, remove the pod from your account
2. Reset the firmware
    1. [Pod 3](docs/pod_3_teardown/6_firmware_reset.jpeg)
    1. [Pod 4](docs/pod_4_teardown/3_reset_firmware.png)
3. Set up the pod as a new pod in the app

## Setup

1. Reset the firmware for your device
    1. [Pod 3](docs/pod_3_teardown/6_firmware_reset.jpeg)
    1. [Pod 4](docs/pod_4_teardown/3_reset_firmware.png)
1. Follow the steps to teardown your device and get access to the circuit board
   1. [Pod 3](docs/pod_3_teardown) 
   1. [Pod 4](docs/pod_4_teardown)

---

### 1. Connect to device

1. Your pod should be unplugged at this point. It doesn't need a connection to the mattress cover OR power at this point
1. Using dupont wires, connect your tag-connect cable to your FTDI FT232RL following the images in [docs/jtag/](docs/jtag/)
1. Connect your tag-connect cable to the circuit board 
   1. [Pod 3](docs/pod_3_teardown/7_pod_3_board_connection.jpeg)
   1. [Pod 4](docs/pod_4_teardown/2_circuit_board.png)
1. Connect your FTDI FT232RL to your computer 

---

### 2. Get the minicom session ready on your computer
- The baud rate is 921600
- Run `ls /dev/tty*`, you should see your FT232RL listed under something like `tty.usbserial-B0010NHK`
```
minicom -b 921600 -o -D /dev/tty.usbserial-B0010NHK
```
- You should see this screen (at least on Mac), if you don't run `ls /dev/tty*`, your device might be under something else

![docs/installation/0_minicom.png](docs/installation/0_minicom.png)


---

### 3. Plug the power into the pod  

Get ready to interrupt the boot when you see `Hit any key to stop autoboot`. (I just hit CTRL + C)

![Interrupt](docs/installation/1_interrupt.png)

If you did it correctly, you'll see this 

![Interrupt success](docs/installation/2_shell.png)

---


### 4.Modify the boot environment, this allows us to get root access

```
# VERIFY your current_slot = a, if not, go back and firmware reset your pod
# If it's still not = a, create an issue in github 
printenv current_slot

# If you have current_slot=a
setenv bootargs "root=PARTLABEL=rootfs_a rootwait init=/bin/bash"

run bootcmd
```

---


### 5. Mount the file system

```
# Mount /proc for process and system information
mount -t proc proc /proc

# Mount /sys for hardware and system-level information
mount -t sysfs sysfs /sys

# Mount /dev for device files (e.g., /dev/mmcblk0)
mount -t devtmpfs devtmpfs /dev

# Mount /run (optional but useful for some runtime scripts)
mount -t tmpfs tmpfs /run

# Mount the file system in read write mode (BE CAREFUL EDITING MODIFYING FILES)
mount -o remount,rw /
```

---


### 6. Update password for root & rewt

```
passwd root
passwd rewt
```
---


### 7. Sync the file changes

```
sync
```

---


### 8. Reboot (DO NOT INTERRUPT BOOT THIS TIME)

```
reboot -f
```

---

### 9. Login as root with the password we set
On the pod 4, this screen will be slightly different, that's OK

![Login](docs/installation/3_login.png)

---


### 10. Disable software updates

You may see some failures saying these services were not loaded or do not exist, that's ok
```
# Disables the software updates
systemctl disable --now swupdate-progress swupdate defibrillator eight-kernel telegraf vector frankenfirmware dac swupdate.socket

# Blocks the software updates if we ever restart or power off the device
systemctl mask swupdate-progress swupdate defibrillator eight-kernel telegraf vector frankenfirmware dac swupdate.socket
```

---

### 11. Setup internet access

```
# Replace WIFI_NAME and PASSWORD with your actual WiFi credentials
# (WIFI_NAME appears twice)
# 
# DO NOT USE A GUEST NETWORK OR TRY TO DO ANYTHING FANCY TO PREVENT IT FROM TALKING TO THE INTERNET
#   If you want to block internet access to the pod, we can do that with firewall rules later

nmcli connection add type wifi con-name WIFI_NAME ifname wlan0 ssid WIFI_NAME wifi-sec.key-mgmt wpa-psk wifi-sec.psk "PASSWORD" ipv4.method auto ipv6.method auto

# (OPTIONAL) This will take your Pod out of the "waiting to be setup" state, and will allow you to turn off the blue blinking LED.
sed -i 's/uuid=.*/uuid=700a7a76-2105-4f46-b1b4-c9f3c791c440/' /persistent/system-connections/*.nmconnection

# Reload the network manager
nmcli connection reload
```

---


### 12. THIS STEP IS FOR POD 4 USERS ONLY! POD 3 USERS SKIP THIS STEP
Your firmware has a different `dac.sock` path location, all you need to do is run this command. This tell the free-sleep app where to establish a dac.sock connection
```
echo '/home/dac/app/sewer/dac.sock' > /home/dac/dac_sock_path.txt
```

---


### 13. Install the free-sleep app, this will set up a systemctl service that auto runs on boot
```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/throwaway31265/free-sleep/main/scripts/install.sh)"
```

---


### 14. Get your pod's IP address

```
# Yours will be different, that's okay
nmcli -g ip4.address device show wlan0
192.168.1.50/24
```

---


### 15. With a device connected to the SAME Wi-Fi network you set up in step 11, navigate to your pod's IP address (port 3000)

SET YOUR TIME ZONE, OR ELSE SCHEDULING WILL NOT WORK! This can be done on the settings page of the web app. See screenshot below

http://192.168.1.50:3000/

![Web App](docs/installation/4_web_app.png)

---


### 16. Validation

#### Verify the site is still up
1. Unplug the power from your device and plug it back in 
2. Wait up to 4 minutes or so, ensure you can still access the site from another device
3. If the site is still up, you should be good

#### Verify the controls work
1. I would recommend setting up steps 16 and 17 below (block WAN traffic & setup SSH access for debugging & upgrading free-sleep)
2. Disconnect the tag-connect cable and power from your pod
3. Connect your pod to the cover as you normally would 4
4. Using the free-sleep site, set a temperature. (I would suggest the highest temp on one side and the lowest temp on the other side)
5. Physically verify the temps change (lay on the cover, use a thermometer, whatever)
6. If the temps change, you're all set! 
7. If it's not working
   1. Create an issue in GitHub with the output from your minicom session
   2. Login as root to your device with your minicom session again and paste the output of these commands
```
systemctl list-units --type=service --no-pager
journalctl -u free-sleep --no-pager --output=cat -n 50
ps aux
find /home/dac/free-sleep/server -path /home/dac/free-sleep/server/node_modules -prune -o -type f -print
which npm
node -v
which node
node -v
iptables -L
```


You can view logs with `journalctl -u free-sleep --no-pager --output=cat` 
I will eventually add a shell script to execute to upgrade free-sleep. Feel free to create pull requests to add new features or fix bugs. Thanks! 



---

## These last steps are optional

### 16. Add firewall rules to block access to the internet (optional, but recommended)
```
sh /home/dac/free-sleep/scripts/block_internet_access.sh

# You can undo this with 
sh /home/dac/free-sleep/scripts/unblock_internet_access.sh
```

---


### 17. Add an ssh config
This will ask for a public key, ssh access is on port 8822 (ex: `ssh root@<POD_IP> -p 8822') 
```
sh /home/dac/free-sleep/scripts/setup_ssh.sh
```

