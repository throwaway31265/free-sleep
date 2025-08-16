# Security Lockdown Installation Guide

This guide will help you secure your system by blocking unwanted domains and restricting incoming network traffic.

## ⚡ Quick Installation

### Step 1: Prepare the System

```bash
# Ensure you have SSH access and know your SSH port
ssh -p 2222 user@your-device

# Switch to root
sudo su
```

### Step 2: Run the Lockdown Script

```bash
# Make the script executable
chmod +x secure-lockdown.sh

# Run the script (will prompt for confirmation)
./secure-lockdown.sh
```

### Step 3: Verify Installation

The script will automatically:

- ✅ Test DNS blocking functionality
- ✅ Verify firewall rules
- ✅ Confirm SSH connectivity
- ✅ Display configuration summary

## 🔧 Custom Configuration

### Different SSH Port

```bash
# If your SSH is on a different port
SSH_PORT=22 ./secure-lockdown.sh
# or
./secure-lockdown.sh --ssh-port 22
```

### Custom Domain List

Edit the `BLOCKED_DOMAINS` array in `secure-lockdown.sh`:

```bash
BLOCKED_DOMAINS=(
    "your-domain.com"
    "another-domain.net"
    "*.tracking-domain.com"
)
```

## 🛡️ What Gets Configured

### DNS Blocking via dnsmasq

- Blocked domains resolve to `127.0.0.1`
- Normal domains resolve through upstream DNS servers
- DNS server runs on localhost (127.0.0.1:53)

### Firewall Rules (iptables)

```bash
# INPUT chain rules (in order):
1. ACCEPT     lo (localhost)
2. ACCEPT     192.168.0.0/16 (private networks)
3. ACCEPT     10.0.0.0/8 (private networks)
4. ACCEPT     172.16.0.0/12 (private networks)
5. ACCEPT     ESTABLISHED,RELATED connections
6. ACCEPT     SSH on specified port
7. DROP       everything else
```

## 🔍 Post-Installation Testing

### Test DNS Blocking

```bash
# These should resolve to 127.0.0.1
nslookup app-api.8slp.net
nslookup device-api.8slp.net

# This should resolve normally
nslookup google.com
```

### Test Firewall

```bash
# Check rules
iptables -L INPUT -n --line-numbers

# Test SSH (should work)
ssh -p 2222 user@your-device

# Test blocked service access from outside
# (should fail from external network)
```

### Test Connectivity

```bash
# Outbound connections should work
curl -I http://google.com

# Blocked domains should fail
curl -I http://app-api.8slp.net
```

## 🚨 Emergency Recovery

### If SSH Access is Lost

1. **Physical/Console Access**: Use direct console access
2. **Run Rollback Script**:

   ```bash
   sudo /etc/secure-lockdown-backups/rollback-TIMESTAMP.sh
   ```

### If DNS Stops Working

```bash
# Temporarily disable dnsmasq
sudo systemctl stop dnsmasq

# Restore original DNS
sudo cp /etc/secure-lockdown-backups/resolv.conf.backup-* /etc/resolv.conf
```

### If Firewall is Too Restrictive

```bash
# Temporarily allow all traffic
sudo iptables -P INPUT ACCEPT
sudo iptables -F INPUT

# Or restore from backup
sudo iptables-restore < /etc/secure-lockdown-backups/iptables.backup-*
```

## 📍 Important File Locations

### Configuration Files

- `/etc/dnsmasq.conf` - DNS blocking configuration
- `/etc/resolv.conf` - DNS resolver settings
- `/etc/iptables/rules.v4` - Saved firewall rules

### Backup Files

- `/etc/secure-lockdown-backups/` - All backups with timestamps
- `/var/log/secure-lockdown.log` - Installation and operation log

### Generated Scripts

- `/etc/secure-lockdown-backups/rollback-TIMESTAMP.sh` - Automatic rollback

## ⚠️ Pre-Installation Checklist

- [ ] **SSH access confirmed** on target port
- [ ] **Root/sudo access** available
- [ ] **Console access** available as backup
- [ ] **Network connectivity** for package installation
- [ ] **Backup of important data** (optional but recommended)

## 🔄 Maintenance

### Adding New Blocked Domains

```bash
# Edit dnsmasq config
sudo nano /etc/dnsmasq.conf

# Add new line:
address=/new-domain.com/127.0.0.1

# Restart dnsmasq
sudo systemctl restart dnsmasq
```

### Removing Blocked Domains

```bash
# Edit dnsmasq config
sudo nano /etc/dnsmasq.conf

# Remove or comment out the line:
# address=/old-domain.com/127.0.0.1

# Restart dnsmasq
sudo systemctl restart dnsmasq
```

### Updating Firewall Rules

```bash
# Add new rule (example: allow port 80)
sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT

# Save rules
sudo iptables-save > /etc/iptables/rules.v4
```

## 🔍 Verification Commands

### Check DNS Blocking

```bash
# Test specific domain
dig @127.0.0.1 app-api.8slp.net

# Check dnsmasq logs
sudo journalctl -u dnsmasq -f
```

### Check Firewall Status

```bash
# List all rules with packet counts
sudo iptables -L -n -v

# Check specific rule
sudo iptables -L INPUT -n --line-numbers
```

### Check Service Status

```bash
# Check dnsmasq
sudo systemctl status dnsmasq

# Check SSH
sudo systemctl status sshd
```

## 📞 Support

If you encounter issues:

1. Check the log file: `/var/log/secure-lockdown.log`
2. Review the troubleshooting section in `SECURITY_LOCKDOWN.md`
3. Use the automatic rollback script if needed
4. Ensure you have physical access to the device before making changes

## 🎯 Success Indicators

After installation, you should see:

- ✅ **DNS blocking**: Blocked domains resolve to 127.0.0.1
- ✅ **Firewall active**: Only SSH and local traffic allowed in
- ✅ **SSH working**: You can still connect via SSH
- ✅ **Internet working**: Normal websites load correctly
- ✅ **Services running**: dnsmasq service is active and enabled

The system is now secured with domain blocking and restrictive firewall rules!
