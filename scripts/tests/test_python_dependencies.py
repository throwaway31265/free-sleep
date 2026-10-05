"""Exercise dependency update scripts with temporary paths and fake Pod commands."""

import os
from pathlib import Path
import subprocess
import tempfile
import unittest


scripts_path = Path(__file__).resolve().parents[1]


class PythonDependencyTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.folder = Path(self.directory.name)
        self.repository = self.folder / 'free-sleep'
        self.environment_folder = self.folder / 'venv'
        self.commands = self.folder / 'commands'
        self.commands.mkdir()
        self.log = self.folder / 'commands.log'
        self.environment = dict(os.environ, PATH=str(self.commands) + ':' + os.environ['PATH'],
                                DEPENDENCY_LOG=str(self.log), REPO_DIR=str(self.repository),
                                STREAM_RESET_MARKER=str(self.folder / 'stream-reset'))
        self.python = self.write_executable(self.environment_folder / 'bin/python', '''#!/bin/sh
printf 'venv-python %s\n' "$*" >> "$DEPENDENCY_LOG"
exit "${PIP_EXIT_CODE:-0}"
''')
        self.write_executable(self.commands / 'python3', '''#!/bin/sh
printf 'system-python %s\n' "$*" >> "$DEPENDENCY_LOG"
exit "${INSTALLATION_STATUS:-97}"
''')
        self.write_executable(self.commands / 'systemctl', '''#!/bin/sh
printf 'systemctl %s\n' "$*" >> "$DEPENDENCY_LOG"
if [ "$1" = is-enabled ]; then exit "${STREAM_DISABLED:-0}"; fi
if [ "$1" = reset-failed ]; then touch "$STREAM_RESET_MARKER"; fi
if [ "$1" = restart ]; then
  if [ "${STREAM_START_LIMIT:-0}" = 1 ] && [ ! -f "$STREAM_RESET_MARKER" ]; then exit 1; fi
  exit "${STREAM_RESTART_EXIT:-0}"
fi
''')
        self.package_script = self.repository / 'scripts/install_python_packages.sh'
        self.write_executable(self.package_script, self.rebase((scripts_path / 'install_python_packages.sh').read_text()))
        requirements = self.repository / 'biometrics/requirements.txt'
        requirements.parent.mkdir(parents=True)
        requirements.write_text((scripts_path.parent / 'biometrics/requirements.txt').read_text())

    def rebase(self, source):
        return (source.replace('/home/dac/free-sleep', str(self.repository))
                .replace('/home/dac/venv', str(self.environment_folder))
                .replace('/persistent/', str(self.folder / 'persistent') + '/')
                .replace('/etc/systemd/system/', str(self.folder / 'systemd') + '/'))

    def write_executable(self, path, source):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source)
        path.chmod(0o755)
        return path

    def run_script(self, source, shell='bash', **environment):
        return subprocess.run([shell], input=source, text=True, capture_output=True,
                              env=dict(self.environment, **environment))

    def installer_dependency_steps(self):
        # Run the real installer hooks, omitting its download and root filesystem setup.
        installer = (scripts_path / 'install.sh').read_text()
        synchronization = installer.split('# Synchronize installed biometrics', 1)[1].split('# --------------------------------------------------------------------------------', 1)[0]
        recovery = installer.split('# Recover an enabled streamer', 1)[1].split('echo "Checking free-sleep service status', 1)[0]
        return self.rebase('set -e\n# Synchronize installed biometrics' + synchronization + '\n# Recover an enabled streamer' + recovery)

    def test_existing_environment_is_reused_and_requirements_are_synchronized(self):
        original_interpreter = self.python.read_bytes()
        for _ in range(2):
            result = subprocess.run(['sh', str(self.package_script)], env=self.environment, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.log.read_text().splitlines()
        self.assertEqual(len(commands), 2)
        self.assertTrue(all('venv-python -m pip install --disable-pip-version-check -r ' in command for command in commands))
        self.assertNotIn('--upgrade', self.log.read_text())
        self.assertEqual(self.python.read_bytes(), original_interpreter)

    def test_package_failure_propagates_to_installer_without_restarting_stream(self):
        result = self.run_script(self.installer_dependency_steps(), PIP_EXIT_CODE='17')
        self.assertEqual(result.returncode, 17, result.stderr)
        self.assertNotIn('systemctl', self.log.read_text())

    def test_update_repairs_existing_environment_and_restarts_enabled_stream(self):
        result = self.run_script(self.installer_dependency_steps(), STREAM_START_LIMIT='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.log.read_text().splitlines()
        self.assertIn('pip install', commands[0])
        self.assertEqual(commands[-2:], ['systemctl reset-failed free-sleep-stream.service',
                                         'systemctl restart free-sleep-stream.service'])

    def test_update_does_not_enable_disabled_biometrics(self):
        result = self.run_script(self.installer_dependency_steps(), STREAM_DISABLED='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('pip install', self.log.read_text())
        self.assertNotIn('restart', self.log.read_text())

    def test_server_only_install_skips_python_dependencies(self):
        self.python.unlink()
        result = self.run_script(self.installer_dependency_steps(), STREAM_DISABLED='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('python', self.log.read_text())

    def setup_enable_script(self):
        for name in ('unblock_internet_access', 'block_internet_access', 'setup_python', 'setup_streamer_service'):
            self.write_executable(self.repository / f'scripts/{name}.sh',
                                  '#!/bin/sh\nprintf "%s\\n" "' + name + '" >> "$DEPENDENCY_LOG"\n')
        self.write_executable(self.commands / 'curl', '#!/bin/sh\nprintf "curl %s\\n" "$*" >> "$DEPENDENCY_LOG"\nexit "${CURL_EXIT_CODE:-0}"\n')
        return self.rebase((scripts_path / 'enable_biometrics.sh').read_text())

    def test_enable_repairs_healthy_installation_without_recreating_python(self):
        result = self.run_script(self.setup_enable_script(), shell='sh', INSTALLATION_STATUS='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.log.read_text()
        self.assertIn('pip install', commands)
        self.assertIn('setup_streamer_service', commands)
        self.assertIn('block_internet_access', commands)
        self.assertNotIn('setup_python', commands)
        self.assertNotIn('calibrate_sensor_thresholds.py', commands)

    def test_enable_restores_firewall_and_reports_dependency_failure(self):
        result = self.run_script(self.setup_enable_script(), shell='sh', INSTALLATION_STATUS='1', PIP_EXIT_CODE='17')
        self.assertEqual(result.returncode, 17, result.stderr)
        commands = self.log.read_text()
        self.assertEqual(commands.splitlines()[-1], 'block_internet_access')
        self.assertIn('"status": "failed"', commands)
        self.assertNotIn('setup_streamer_service', commands)

    def test_enable_restores_firewall_even_when_error_reporting_fails(self):
        result = self.run_script(self.setup_enable_script(), shell='sh', INSTALLATION_STATUS='1',
                                 PIP_EXIT_CODE='17', CURL_EXIT_CODE='7')
        self.assertEqual(result.returncode, 17, result.stderr)
        self.assertEqual(self.log.read_text().splitlines()[-1], 'block_internet_access')

    def test_stream_setup_restarts_after_clearing_start_limit(self):
        (self.folder / 'systemd').mkdir()
        source = self.rebase((scripts_path / 'setup_streamer_service.sh').read_text())
        result = self.run_script(source, shell='sh', STREAM_START_LIMIT='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.log.read_text().splitlines()
        self.assertEqual(commands[-3:], [
            'systemctl reset-failed free-sleep-stream.service',
            'systemctl restart free-sleep-stream.service',
            'systemctl status free-sleep-stream.service --no-pager',
        ])

    def test_stream_setup_propagates_restart_failure(self):
        (self.folder / 'systemd').mkdir()
        source = self.rebase((scripts_path / 'setup_streamer_service.sh').read_text())
        result = self.run_script(source, shell='sh', STREAM_RESTART_EXIT='17')
        self.assertEqual(result.returncode, 17, result.stderr)
        self.assertNotIn('systemctl status', self.log.read_text())

    def setup_update_script(self, installer_source):
        self.setup_enable_script()
        (self.repository / 'release.txt').write_text('previous release')
        installer_file = self.folder / 'installer.sh'
        installer_file.write_text(installer_source)
        self.environment['TEST_INSTALLER_SOURCE'] = str(installer_file)
        self.write_executable(self.commands / 'curl', '''#!/bin/sh
if [ "${CURL_EXIT_CODE:-0}" != 0 ]; then exit "$CURL_EXIT_CODE"; fi
cat "$TEST_INSTALLER_SOURCE"
''')
        return self.rebase((scripts_path / 'update.sh').read_text())

    def assert_update_restored_backup(self, result):
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.repository / 'release.txt').read_text(), 'previous release')
        self.assertFalse(self.repository.with_name('free-sleep-backup').exists())
        self.assertIn('block_internet_access', self.log.read_text().splitlines())
        self.assertNotIn('Update completed successfully', result.stdout)

    def test_update_download_failure_preserves_backup_and_reports_failure(self):
        result = self.run_script(self.setup_update_script(''), CURL_EXIT_CODE='22')
        self.assert_update_restored_backup(result)

    def test_update_empty_download_preserves_backup_and_reports_failure(self):
        result = self.run_script(self.setup_update_script(''))
        self.assert_update_restored_backup(result)

    def test_update_missing_install_directory_preserves_backup(self):
        result = self.run_script(self.setup_update_script('exit 0\n'))
        self.assert_update_restored_backup(result)

    def replacement_installer(self):
        # Stand in for the downloaded installer without accessing the network or system files.
        return '''set -e
mkdir -p "$REPO_DIR"
cp -R "$REPO_DIR-backup/." "$REPO_DIR/"
printf 'new release' > "$REPO_DIR/release.txt"
sh "$REPO_DIR/scripts/install_python_packages.sh"
'''

    def test_update_package_failure_restores_previous_install_and_returns_failure(self):
        result = self.run_script(self.setup_update_script(self.replacement_installer()), PIP_EXIT_CODE='17')
        self.assert_update_restored_backup(result)

    def test_update_success_removes_backup_only_after_installation(self):
        result = self.run_script(self.setup_update_script(self.replacement_installer()))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.repository / 'release.txt').read_text(), 'new release')
        self.assertFalse(self.repository.with_name('free-sleep-backup').exists())
        self.assertIn('Update completed successfully', result.stdout)


if __name__ == '__main__':
    unittest.main()
