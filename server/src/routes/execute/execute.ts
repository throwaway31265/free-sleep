import express, { type Request, type Response } from 'express';
import { executeFunction, frankenCommands } from '../../8sleep/deviceApi.js';
import logger from '../../logger.js';

const router = express.Router();

router.post('/execute', async (req: Request, res: Response) => {
  const { command, arg } = req.body;

  try {
    // Basic validation
    if (!Object.keys(frankenCommands).includes(command)) {
      res.status(400).send('Invalid command');
      return;
    }

    // Execute the 8sleep command
    await executeFunction(
      command as keyof typeof frankenCommands,
      arg || 'empty',
    );

    // Respond with success
    res.json({
      success: true,
      message: `Command '${command}' executed successfully.`,
    });
    return;
  } catch (error) {
    logger.error({ error });
    res.status(500).json({
      error: 'An error occurred while executing the command.',
      details: error,
    });
  }
});

export default router;
