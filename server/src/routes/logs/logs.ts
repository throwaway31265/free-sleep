import express from 'express';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const router = express.Router();

const LOGS_DIRS = ['/persistent/free-sleep-data/logs', '/var/log'];

// Endpoint to list all log files as clickable links
router.get('/', (req, res) => {
  let allLogFiles: string[] = [];

  // Read logs from both directories
  LOGS_DIRS.forEach((dir) => {
    if (!fs.existsSync(dir)) return;

    try {
      const files = fs
        .readdirSync(dir)
        .map((file) => {
          const fullPath = path.join(dir, file);

          try {
            const stat = fs.lstatSync(fullPath);
            return stat.isFile() && file.endsWith('log')
              ? { name: file, path: fullPath, mtime: stat.mtime.getTime() }
              : null;
          } catch (error) {
            console.warn(`Skipping invalid file: ${fullPath}`);
            return null;
          }
        })
        .filter(Boolean);

      // @ts-ignore
      allLogFiles = [...allLogFiles, ...files];
    } catch (err) {
      console.error(`Error reading logs from ${dir}:`, err);
    }
  });

  // @ts-ignore
  allLogFiles.sort((a, b) => b.mtime - a.mtime);

  res.json({
    // @ts-ignore
    logs: allLogFiles.map((log) => log.name),
  });
});

// @ts-ignore
router.get('/:filename', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const filename = req.params.filename;

  let logFilePath = null;
  for (const dir of LOGS_DIRS) {
    const fullPath = path.join(dir, filename);
    if (fs.existsSync(fullPath)) {
      logFilePath = fullPath;
      break;
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
    if (logBuffer.length > 1000) logBuffer.shift(); // Keep last 1000 lines
  }

  res.write(`data: ${JSON.stringify({ message: logBuffer.join('\n') })}\n\n`);

  // @ts-ignore
  const logStream = fs.watch(logFilePath, { interval: 1000 }, async () => {
    const newFileStream = fs.createReadStream(logFilePath, {
      encoding: 'utf8',
    });
    const newRl = readline.createInterface({ input: newFileStream });

    const newLogs = [];
    for await (const line of newRl) newLogs.push(line);

    if (newLogs.length > logBuffer.length) {
      const newEntries = newLogs.slice(-1000);
      logBuffer = newEntries;
      res.write(
        `data: ${JSON.stringify({ message: newEntries.join('\n') })}\n\n`,
      );
    }
  });

  req.on('close', () => {
    logStream.close();
    res.end();
  });
});

export default router;
