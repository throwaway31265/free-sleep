import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import logger from '../../logger.js';

const router = express.Router();

interface VersionInfo {
  branch?: string;
  commitHash?: string;
  commitTitle?: string;
  buildDate?: string;
}

router.get('/version', async (req: Request, res: Response) => {
  try {
    // Try to read git info file created by install script
    const gitInfoPath = path.join(process.cwd(), '.git-info');

    let versionInfo: VersionInfo = {};

    if (fs.existsSync(gitInfoPath)) {
      try {
        const gitInfoContent = fs.readFileSync(gitInfoPath, 'utf8');
        const gitInfo = JSON.parse(gitInfoContent);
        versionInfo = {
          branch: gitInfo.branch,
          commitHash: gitInfo.commitHash,
          commitTitle: gitInfo.commitTitle,
          buildDate: gitInfo.buildDate,
        };
      } catch (parseError) {
        logger.warn('Failed to parse git info file:', parseError);
      }
    } else {
      // Try to read branch info file (legacy support)
      const branchInfoPath = path.join(process.cwd(), '.git-branch-info');
      if (fs.existsSync(branchInfoPath)) {
        try {
          const branch = fs.readFileSync(branchInfoPath, 'utf8').trim();
          if (branch) {
            versionInfo.branch = branch;
          }
        } catch (readError) {
          logger.warn('Failed to read branch info file:', readError);
        }
      }
    }

    res.json(versionInfo);
  } catch (error) {
    logger.error('Error fetching version info:', error);
    res.status(500).json({
      error: 'Failed to fetch version information',
      details: error,
    });
  }
});

export default router;
