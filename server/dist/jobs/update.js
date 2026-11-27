import { spawn } from 'child_process';
import logger from '../logger.js';
export default function update() {
    logger.debug('Updating free-sleep...');
    const child = spawn('sudo', ['/bin/systemctl', 'start', 'free-sleep-update.service', '--no-block'], {
        stdio: 'ignore',
        detached: true,
    });
    child.unref();
}
//# sourceMappingURL=update.js.map