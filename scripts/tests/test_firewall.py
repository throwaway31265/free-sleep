"""Run the real firewall scripts against a mock firewall and probe resulting rules.

Run with: python3 -m unittest discover -s scripts/tests -p 'test_firewall.py' -v
"""

import ipaddress
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
import unittest


scripts_path = Path(__file__).resolve().parents[1]
firewall_commands = ('iptables', 'ip6tables')
public_resolvers = ('50.0.1.1', '2001:4860:4860::8888')


class FirewallTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.folder = Path(self.directory.name)
        self.commands = self.folder / 'bin'
        self.commands.mkdir()
        self.configuration = self.folder / 'etc'
        (self.configuration / 'systemd').mkdir(parents=True)
        (self.configuration / 'iptables').mkdir()
        self.resolvers = self.configuration / 'resolv.conf'
        self.resolvers.write_text(''.join(f'nameserver {address}\n' for address in public_resolvers))
        self.state_path = self.folder / 'firewall.json'
        self.write_state({command: {'filter': {'INPUT': [], 'OUTPUT': [], 'FORWARD': []}}
                          for command in firewall_commands})
        self.environment = dict(os.environ, PATH=str(self.commands) + os.pathsep + os.environ['PATH'],
                                FIREWALL_TEST_STATE=str(self.state_path), ALLOW_SENTRY='false')
        mock_path = scripts_path / 'tests/firewall_mock.py'
        for command in (*firewall_commands, 'iptables-save', 'ip6tables-save', 'systemctl'):
            executable = self.commands / command
            executable.write_text(f'#!/bin/sh\nexec {shlex.quote(sys.executable)} '
                                  f'{shlex.quote(str(mock_path))} {command} "$@"\n')
            executable.chmod(0o755)

    def read_state(self):
        return json.loads(self.state_path.read_text())

    def write_state(self, state):
        self.state_path.write_text(json.dumps(state))

    def run_script(self, action='block', **environment):
        source = (scripts_path / f'{action}_internet_access.sh').read_text()
        source = source.replace('/etc/', str(self.configuration) + '/')
        return subprocess.run(['sh'], input=source, text=True, capture_output=True,
                              env=dict(self.environment, **environment), timeout=30)

    def block(self, **environment):
        result = self.run_script(**environment)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result

    def seed_legacy_drops(self, commands=firewall_commands):
        # Old unblock scripts clear only IPv4, leaving IPv6 DROP rules during upgrades.
        state = self.read_state()
        for command in commands:
            for chain in ('INPUT', 'OUTPUT'):
                state[command]['filter'][chain].append(['-j', 'DROP'])
        self.write_state(state)

    def verdict(self, address, chain, protocol, port, connection='NEW', source_port=40000):
        """Evaluate first-match rule ordering for a packet on the external interface."""
        command = 'ip6tables' if ':' in address else 'iptables'
        address_flag = '-d' if chain == 'OUTPUT' else '-s'
        for rule in self.read_state()[command]['filter'][chain]:
            options = dict(zip(rule[::2], rule[1::2]))
            self.assertFalse(set(options) - {'-d', '-s', '-p', '--dport', '--sport',
                                            '-m', '--ctstate', '-i', '-o', '-j'})
            if address_flag in options and ipaddress.ip_address(address) not in ipaddress.ip_network(options[address_flag]):
                continue
            if options.get('-p', protocol) != protocol:
                continue
            if int(options.get('--dport', port)) != port:
                continue
            if int(options.get('--sport', source_port)) != source_port:
                continue
            if '--ctstate' in options and connection not in options['--ctstate'].split(','):
                continue
            if options.get('-i', 'wlan0') != 'wlan0' or options.get('-o', 'wlan0') != 'wlan0':
                continue
            return options['-j']
        return 'ACCEPT'

    def assert_dns_allowed(self, addresses=public_resolvers):
        for address in addresses:
            for protocol in ('udp', 'tcp'):
                with self.subTest(address=address, protocol=protocol):
                    self.assertEqual(self.verdict(address, 'OUTPUT', protocol, 53), 'ACCEPT')
                    self.assertEqual(self.verdict(address, 'INPUT', protocol, 40000,
                                                  connection='ESTABLISHED', source_port=53), 'ACCEPT')

    def assert_wan_blocked(self):
        for address in public_resolvers:
            for protocol in ('udp', 'tcp'):
                with self.subTest(address=address, protocol=protocol):
                    self.assertEqual(self.verdict(address, 'OUTPUT', protocol, 443), 'DROP')
                    self.assertEqual(self.verdict(address, 'INPUT', protocol, 3000), 'DROP')
                    # Merely using source port 53 must not expose the Pod's API to the WAN.
                    self.assertEqual(self.verdict(address, 'INPUT', protocol, 3000, source_port=53), 'DROP')

    def restore_saved_rules(self):
        self.write_state({command: json.loads((self.configuration / 'iptables' / f'{command}.rules').read_text())
                          for command in firewall_commands})

    def test_fresh_block_allows_dns_and_ntp_but_blocks_other_wan_traffic(self):
        self.block()
        self.assert_dns_allowed()
        self.assert_wan_blocked()
        for address in public_resolvers:
            self.assertEqual(self.verdict(address, 'OUTPUT', 'udp', 123), 'ACCEPT')
            self.assertEqual(self.verdict(address, 'INPUT', 'udp', 40000, source_port=123), 'ACCEPT')

    def test_upgrade_after_old_ipv4_only_unblock_repairs_and_persists_ipv6_dns(self):
        self.seed_legacy_drops(commands=('ip6tables',))
        self.block()
        self.assert_dns_allowed()
        self.assert_wan_blocked()
        self.restore_saved_rules()
        self.assert_dns_allowed()

    def test_reapplying_block_repairs_both_families_without_unblocking(self):
        self.seed_legacy_drops()
        self.block()
        self.assert_dns_allowed()
        self.assert_wan_blocked()

    def test_resolver_changes_work_without_rerunning_script_and_after_restore(self):
        self.block()
        changed_resolvers = ('9.9.9.9', '2620:fe::fe')
        self.resolvers.write_text(''.join(f'nameserver {address}\n' for address in changed_resolvers))
        self.assert_dns_allowed(changed_resolvers)
        self.restore_saved_rules()
        self.assert_dns_allowed(changed_resolvers)
        self.assert_wan_blocked()

    def test_resolvers_can_be_configured_after_blocking(self):
        self.resolvers.unlink()
        self.block()
        self.assert_dns_allowed()

    def test_repeated_block_moves_shadowed_dns_rules_and_removes_duplicates(self):
        self.block()
        state = self.read_state()
        for command in firewall_commands:
            for rules in state[command]['filter'].values():
                dns_rules = [rule for rule in rules if '53' in rule]
                rules.extend(dns_rules)
                rules.insert(0, ['-j', 'DROP'])
        self.write_state(state)
        self.block()
        self.assert_dns_allowed()
        self.assert_wan_blocked()
        for command in firewall_commands:
            for chain in ('INPUT', 'OUTPUT'):
                dns_rules = [rule for rule in self.read_state()[command]['filter'][chain] if '53' in rule]
                self.assertEqual(len(dns_rules), 2)

    def test_unblock_clears_both_families_even_without_ipv6_nat_support(self):
        self.block()
        result = self.run_script('unblock', FAIL_IPV6_NAT='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        for command in firewall_commands:
            self.assertTrue(all(not rules for rules in self.read_state()[command]['filter'].values()))
        self.block()
        self.assert_dns_allowed()
        self.assert_wan_blocked()

    def test_dns_rule_failure_reports_failure_and_still_installs_wan_blocks(self):
        result = self.run_script(FAIL_DNS_INSERT='ip6tables')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Failed to install DNS allowances', result.stderr)
        self.assertNotIn('Blocked WAN internet access successfully', result.stdout)
        self.assert_wan_blocked()

    def test_dns_also_works_with_default_sentry_allowances(self):
        self.block(ALLOW_SENTRY='true')
        self.assert_dns_allowed()
        self.assert_wan_blocked()


if __name__ == '__main__':
    unittest.main()
