# Time Synchronization Solution

## Problem Description

Pod devices can experience incorrect time, causing scheduled events (priming, alarms, etc.) to occur at the wrong time. This happens because:

1. **Internet blocking prevents NTP sync**: When internet access is blocked for security, the pod cannot reach time servers
2. **Boot time issues**: Pods may boot with incorrect dates (e.g., year 2010)
3. **Manual power cycles don't fix time**: The hardware clock may not maintain accurate time

## Solution Overview

The enhanced installation script now provides a comprehensive time synchronization solution with multiple fallback mechanisms:

### 1. **Proper NTP Configuration** (`systemd-timesyncd`)

- Configures multiple reliable NTP servers (pool.ntp.org, Google time servers)
- Enables automatic time synchronization when internet is available
- Stops conflicting time services (ntp, chrony) to avoid conflicts

### 2. **Manual Time Sync Fallback**

- Multiple time sources: Google, WorldTimeAPI, pool.ntp.org
- Robust error handling with timeouts
- Works even when NTP service is unavailable

### 3. **Periodic Time Sync for Blocked Internet**

- Automated cron job runs twice daily (6 AM and 6 PM)
- Temporarily unblocks internet access for time sync
- Re-blocks internet access after synchronization
- Comprehensive logging for troubleshooting

## Implementation Details

### Installation Script Changes

The `install.sh` script now includes:

```bash
# New time synchronization section
- Configure NTP servers with fallbacks
- Enable systemd-timesyncd service
- Manual time sync during installation
- Setup periodic sync cron job
- Create sync script at /usr/local/bin/sync-time-with-internet.sh
```

### Files Created/Modified

1. **`/etc/systemd/timesyncd.conf`** - NTP server configuration
2. **`/usr/local/bin/sync-time-with-internet.sh`** - Periodic sync script
3. **Root crontab** - Scheduled time sync (6 AM and 6 PM daily)
4. **`/persistent/free-sleep-data/logs/time-sync.log`** - Sync operation logs

### NTP Server Configuration

```ini
[Time]
NTP=pool.ntp.org 0.pool.ntp.org 1.pool.ntp.org 2.pool.ntp.org 3.pool.ntp.org
FallbackNTP=time1.google.com time2.google.com time3.google.com time4.google.com
RootDistanceMaxSec=5
PollIntervalMinSec=32
PollIntervalMaxSec=2048
```

### Periodic Sync Script Logic

```bash
1. Check if internet is blocked (test connectivity)
2. If blocked:
   a. Temporarily unblock internet access
   b. Force NTP synchronization
   c. Wait for sync completion
   d. Re-block internet access
3. If not blocked:
   a. Perform standard NTP sync
4. Log all operations with timestamps
```

## Usage

### Automatic Operation

- Time sync happens automatically during installation
- Periodic sync runs twice daily without user intervention
- Logs are maintained in `/persistent/free-sleep-data/logs/time-sync.log`

### Manual Operation

```bash
# Force immediate time sync
sudo /usr/local/bin/sync-time-with-internet.sh

# Check time sync status
timedatectl status

# View time sync logs
tail -f /persistent/free-sleep-data/logs/time-sync.log

# Check NTP service status
systemctl status systemd-timesyncd
```

### Troubleshooting Commands

```bash
# Restart NTP service
sudo systemctl restart systemd-timesyncd

# Force NTP sync
sudo timedatectl set-ntp true

# Check current time sources
timedatectl show-timesync --all

# View detailed NTP logs
journalctl -u systemd-timesyncd -f
```

## Benefits

1. **Automatic Resolution**: Installation script now fixes time issues automatically
2. **Multiple Fallbacks**: Works even if primary NTP servers are unreachable
3. **Security Friendly**: Works with blocked internet configurations
4. **Persistent**: Survives reboots and maintains ongoing synchronization
5. **Observable**: Comprehensive logging for troubleshooting
6. **Backwards Compatible**: Doesn't break existing installations

## Verification

After running the updated installation script, verify the solution:

```bash
# 1. Check NTP service status
systemctl is-active systemd-timesyncd
# Expected: active

# 2. Check time sync status
timedatectl status | grep "System clock synchronized"
# Expected: System clock synchronized: yes

# 3. Verify cron job exists
crontab -l | grep sync-time-with-internet
# Expected: 0 6,18 * * * /usr/local/bin/sync-time-with-internet.sh

# 4. Test manual sync
sudo /usr/local/bin/sync-time-with-internet.sh
# Check logs: tail /persistent/free-sleep-data/logs/time-sync.log
```

## Compatibility

- **Existing Installations**: Script safely updates existing pods
- **All Pod Versions**: Works with Pod 3 and Pod 4 hardware
- **Branch Support**: Available in both main and beta branches
- **Network Configurations**: Works with both open and blocked internet

## Future Considerations

- **Hardware RTC**: Consider hardware real-time clock upgrades for better time persistence
- **Local NTP Server**: Option to setup local NTP server on the network
- **More Frequent Sync**: Adjust sync frequency based on clock drift observations
- **Time Zone Handling**: Enhanced timezone detection and configuration
