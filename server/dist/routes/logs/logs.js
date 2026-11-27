import express from 'express';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import logger from '../../logger.js';
const router = express.Router();
const LOGS_DIRS = ['/persistent/free-sleep-data/logs', '/var/log'];
const { promises: fsPromises } = fs;
// Endpoint to list all log files as clickable links
router.get('/', async (req, res) => {
    try {
        const logFilesPerDir = await Promise.all(LOGS_DIRS.map(async (dir) => {
            try {
                await fsPromises.access(dir, fs.constants.R_OK);
            }
            catch {
                return [];
            }
            let files;
            try {
                files = await fsPromises.readdir(dir);
            }
            catch (error) {
                logger.error(`Error reading logs from ${dir}:`, error);
                return [];
            }
            const fileStats = await Promise.all(files.map(async (file) => {
                if (!file.endsWith('log')) {
                    return null;
                }
                const fullPath = path.join(dir, file);
                try {
                    const stat = await fsPromises.lstat(fullPath);
                    if (!stat.isFile()) {
                        return null;
                    }
                    return { name: file, path: fullPath, mtime: stat.mtime.getTime() };
                }
                catch (error) {
                    logger.warn(`Skipping invalid file: ${fullPath}`);
                    return null;
                }
            }));
            return fileStats.filter((fileStat) => fileStat !== null);
        }));
        const allLogFiles = logFilesPerDir.flat().sort((a, b) => b.mtime - a.mtime);
        res.json({
            logs: allLogFiles.map(log => log.name),
        });
    }
    catch (error) {
        logger.error('Unexpected error while listing log files', error);
        res.status(500).json({ message: 'Unable to list log files' });
    }
});
router.get('/:filename', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const filename = req.params.filename;
    let logFilePath = null;
    for (const dir of LOGS_DIRS) {
        const fullPath = path.join(dir, filename);
        try {
            await fsPromises.access(fullPath, fs.constants.R_OK);
            logFilePath = fullPath;
            break;
        }
        catch {
            continue;
        }
    }
    if (!logFilePath) {
        res.write(`data: ${JSON.stringify({ message: 'Log file not found' })}\n\n`);
        return res.end();
    }
    let logBuffer = [];
    const fileStream = fs.createReadStream(logFilePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream });
    for await (const line of rl) {
        logBuffer.push(line);
        if (logBuffer.length > 1000)
            logBuffer.shift(); // Keep last 1000 lines
    }
    res.write(`data: ${JSON.stringify({ message: logBuffer.join('\n') })}\n\n`);
    // @ts-ignore
    const logStream = fs.watch(logFilePath, { interval: 1000 }, async () => {
        const newFileStream = fs.createReadStream(logFilePath, { encoding: 'utf8' });
        const newRl = readline.createInterface({ input: newFileStream });
        const newLogs = [];
        for await (const line of newRl)
            newLogs.push(line);
        if (newLogs.length > logBuffer.length) {
            const newEntries = newLogs.slice(-1000);
            logBuffer = newEntries;
            res.write(`data: ${JSON.stringify({ message: newEntries.join('\n') })}\n\n`);
        }
    });
    req.on('close', () => {
        logStream.close();
        res.end();
    });
});
export default router;
//# sourceMappingURL=logs.js.map