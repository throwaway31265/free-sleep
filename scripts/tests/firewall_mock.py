"""Model the iptables operations used by the firewall scripts without root access."""

import json
import os
from pathlib import Path
import sys


def main():
    command, *arguments = sys.argv[1:]
    if command == 'systemctl':
        return 0

    state_path = Path(os.environ['FIREWALL_TEST_STATE'])
    state = json.loads(state_path.read_text())
    family = 'ip6tables' if command.startswith('ip6tables') else 'iptables'
    if command.endswith('-save'):
        print(json.dumps(state[family]))
        return 0

    table_name = 'filter'
    if arguments[:1] == ['-t']:
        table_name = arguments[1]
        arguments = arguments[2:]
    if family == 'ip6tables' and table_name == 'nat' and os.environ.get('FAIL_IPV6_NAT'):
        return 1

    table = state[family].setdefault(table_name, {'INPUT': [], 'OUTPUT': [], 'FORWARD': []})
    operation = arguments[0]
    if operation == '-F':
        for rules in table.values():
            rules.clear()
    elif operation == '-X':
        pass  # The scripts do not create user-defined chains.
    elif operation in ('-A', '-I', '-C', '-D'):
        rules = table[arguments[1]]
        rule = arguments[2:]
        if operation == '-C':
            return 0 if rule in rules else 1
        if operation == '-D':
            if rule not in rules:
                return 1
            rules.remove(rule)
        elif operation == '-A':
            rules.append(rule)
        else:
            if os.environ.get('FAIL_DNS_INSERT') == family and '53' in rule:
                print('Simulated DNS rule failure', file=sys.stderr)
                return 1
            rules.insert(0, rule)
    else:
        raise ValueError(f'Unsupported firewall operation: {arguments}')

    state_path.write_text(json.dumps(state))
    return 0


if __name__ == '__main__':
    sys.exit(main())
