
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="e98914ee-d57f-5bd9-90d0-dcb8a03e7238")}catch(e){}}();
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
//# debugId=e98914ee-d57f-5bd9-90d0-dcb8a03e7238
