# Secure System Lockdown

A comprehensive bash script to secure Linux systems by implementing DNS-based domain blocking and restrictive firewall rules.

## 🔒 What This Script Does

### DNS Blocking

- Installs and configures **dnsmasq** for DNS-level domain blocking
- Redirects blocked domains to `127.0.0.1` (localhost)
- Maintains normal DNS resolution for non-blocked domains
- Automatically configures system DNS settings

### Firewall Security

- Blocks **ALL incoming traffic** except:
  - SSH on specified port (default: 2222)
  - Localhost traffic (127.0.0.1)
  - Private network traffic (10.x.x.x, 172.16.x.x, 192.168.x.x)
  - Established/related connections (for outbound responses)
- Allows **ALL outgoing traffic** (device can make requests)
- Persists rules across reboots

### Safety Features

- **Automatic backups** of all modified files
- **Rollback script** generation for easy recovery
- **Pre-flight checks** to ensure SSH connectivity
- **Comprehensive logging** to `/var/log/secure-lockdown.log`

## 📋 Prerequisites

- **Root access** (script must be run with `sudo`)
- **SSH running** on the target port (default: 2222)
- **Linux system** with systemd (Ubuntu, Debian, CentOS, etc.)
- **Internet connection** for package installation

## 🚀 Quick Start

### 1. Copy the Script

```bash
# Script is already in this repository as secure-lockdown.sh
chmod +x secure-lockdown.sh
```

### 2. Run the Script

```bash
sudo ./secure-lockdown.sh
```

### 3. Verify Configuration

The script will automatically test DNS blocking and firewall rules, then display a summary.

## ⚙️ Configuration Options

### SSH Port Configuration

```bash
# Set SSH port via environment variable
SSH_PORT=2222 sudo ./secure-lockdown.sh

# Or use command line argument
sudo ./secure-lockdown.sh --ssh-port 2222
```

### Custom Domain Blocking

Edit the `BLOCKED_DOMAINS` array in the script to add/remove domains:

```bash
BLOCKED_DOMAINS=(
    "example.com"
    "subdomain.example.com"
    "another-domain.net"
)
```

### DNS Servers

Modify the `DNS_SERVERS` array to use different upstream DNS servers:

```bash
DNS_SERVERS=("1.1.1.1" "8.8.8.8" "192.168.1.1")
```

## 🔧 Advanced Usage

### Command Line Options

```bash
# Show help
sudo ./secure-lockdown.sh --help

# Specify SSH port
sudo ./secure-lockdown.sh --ssh-port 2222
```

### Environment Variables

```bash
# Set SSH port
export SSH_PORT=2222
sudo -E ./secure-lockdown.sh
```

## 📁 File Locations

### Configuration Files

- `/etc/dnsmasq.conf` - DNS blocking configuration
- `/etc/resolv.conf` - DNS resolver settings
- `/etc/iptables/rules.v4` - Firewall rules

### Backup Directory

- `/etc/secure-lockdown-backups/` - All backups with timestamps
- `/var/log/secure-lockdown.log` - Execution log

### Generated Files

- `rollback-TIMESTAMP.sh` - Automatic rollback script
- `*.backup-TIMESTAMP` - Timestamped backups of all modified files

## 🔄 Rollback/Recovery

### Automatic Rollback

A rollback script is created in the backup directory:

```bash
sudo /etc/secure-lockdown-backups/rollback-TIMESTAMP.sh
```

### Manual Rollback

```bash
# Restore dnsmasq configuration
sudo cp /etc/secure-lockdown-backups/dnsmasq.conf.backup-TIMESTAMP /etc/dnsmasq.conf

# Restore DNS resolver
sudo cp /etc/secure-lockdown-backups/resolv.conf.backup-TIMESTAMP /etc/resolv.conf

# Restore firewall rules
sudo iptables-restore < /etc/secure-lockdown-backups/iptables.backup-TIMESTAMP

# Restart services
sudo systemctl restart dnsmasq
sudo systemctl restart networking
```

## 🧪 Testing

### DNS Blocking Test

```bash
# Should resolve to 127.0.0.1
nslookup app-api.8slp.net 127.0.0.1

# Should resolve normally
nslookup google.com 127.0.0.1
```

### Firewall Test

```bash
# Check SSH access (should work)
ssh -p 2222 user@your-server

# Check firewall rules
sudo iptables -L INPUT -n --line-numbers
```

### Connectivity Test

```bash
# Outbound should work
curl -I http://google.com

# Blocked domains should fail
curl -I http://app-api.8slp.net
```

## ⚠️ Important Notes

### Before Running

1. **Test SSH connectivity** to ensure you won't be locked out
2. **Verify the SSH port** is correct (default: 2222)
3. **Have console access** available as backup
4. **Review blocked domains** in the script

### After Running

1. **Test SSH immediately** after script completion
2. **Keep rollback script accessible** for emergencies
3. **Verify services** are working as expected
4. **Check logs** for any errors

### Security Considerations

- Script requires root privileges
- Firewall rules persist across reboots
- DNS blocking affects all users on the system
- Local services can still communicate internally

## 🐛 Troubleshooting

### Common Issues

**SSH Connection Lost**

```bash
# Use console access or recovery mode
sudo /etc/secure-lockdown-backups/rollback-TIMESTAMP.sh
```

**DNS Not Working**

```bash
# Check dnsmasq status
sudo systemctl status dnsmasq

# Check DNS configuration
cat /etc/resolv.conf
```

**Firewall Too Restrictive**

```bash
# Check current rules
sudo iptables -L -n

# Temporarily allow specific port
sudo iptables -I INPUT -p tcp --dport PORT -j ACCEPT
```

### Log Files

- Main log: `/var/log/secure-lockdown.log`
- System logs: `journalctl -u dnsmasq`
- Firewall logs: `journalctl -k | grep iptables`

## 📝 Supported Systems

### Tested On

- Ubuntu 20.04+
- Debian 10+
- CentOS 8+
- Amazon Linux 2
- Alpine Linux (with modifications)

### Package Managers

- `apt-get` (Ubuntu/Debian)
- `yum` (CentOS/RHEL)
- `apk` (Alpine Linux)

## 🔍 Default Blocked Domains

The script comes pre-configured to block these 8sleep.net domains:

- `8slp.net` (wildcard)
- `app-api.8slp.net`
- `app-api.staging.8slp.net`
- `app-media.8slp.net`
- `auth-api.8slp.net`
- `client-api.8slp.net`
- `client-api.staging.8slp.net`
- `device-api-ws.8slp.net`
- `device-api.8slp.net`
- `fw.8slp.net`
- `jira.8slp.net`
- `logs.8slp.net`
- `luna-api.8slp.net`
- `metrics-api.8slp.net`
- `mfg-data-api.8slp.net`
- `ops-api.8slp.net`
- `portal.8slp.net`
- `raw-api-upload.8slp.net`
- `remote-connectivity-api.8slp.net`
- `s.8slp.net`
- `staging-ci.8slp.net`
- `staging.8slp.net`
- `status.8slp.net`
- `trail.8slp.net`
- `update-api.8slp.net`
- `vpn.8slp.net`
- `webauth-api.8slp.net`
- `wifi.8slp.net`
- `www.s.8slp.net`

## 🔍 Script Structure

```
secure-lockdown.sh
├── Configuration Variables
├── Utility Functions
├── DNS Blocking Setup
│   ├── Install dnsmasq
│   ├── Configure blocking
│   └── Test functionality
├── Firewall Configuration
│   ├── Set INPUT rules
│   ├── Save rules
│   └── Test connectivity
└── Backup & Recovery
    ├── Create backups
    ├── Generate rollback
    └── Display summary
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
