
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="04ac16c8-264b-56af-83e6-cf6d68a77abb")}catch(e){}}();
import { exec } from 'child_process';
import logger from '../logger.js';
export default function reboot() {
    logger.debug('Rebooting pod...');
    exec('sudo /sbin/reboot', (error, stdout, stderr) => {
        if (error) {
            logger.error(`Error: ${error.message}`);
            return;
        }
        if (stderr) {
            logger.error(`Stderr: ${stderr}`);
            return;
        }
        logger.debug(`Stdout: ${stdout}`);
    });
}
//# sourceMappingURL=reboot.js.map
//# debugId=04ac16c8-264b-56af-83e6-cf6d68a77abb
