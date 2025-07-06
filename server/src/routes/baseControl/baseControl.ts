import express from 'express';
import { z } from 'zod';
import logger from '../../logger.js';
import memoryDB from '../../db/memoryDB.js';
import { trimixBase } from '../../8sleep/trimixBaseControl.js';
import { BASE_PRESETS } from '../../8sleep/basePresets.js';

const router = express.Router();

// Schema for base position request
const BasePositionSchema = z.object({
  head: z
    .number()
    .min(0, { message: 'Head angle must be at least 0°' })
    .max(60, { message: 'Head angle cannot exceed 60°' }),
  feet: z
    .number()
    .min(0, { message: 'Feet angle must be at least 0°' })
    .max(45, { message: 'Feet angle cannot exceed 45°' }),
  feedRate: z
    .number()
    .min(30, { message: 'Feed rate must be at least 30' })
    .max(100, { message: 'Feed rate cannot exceed 100' })
    .optional()
    .default(50),
});

const BaseStatusSchema = z.object({
  head: z.number(),
  feet: z.number(),
  isMoving: z.boolean(),
  lastUpdate: z.string(),
});

export type BasePosition = z.infer<typeof BasePositionSchema>;
export type BaseStatus = z.infer<typeof BaseStatusSchema>;

// GET /api/base-control
router.get('/base-control', async (_req, res) => {
  try {
    // Check if base is configured
    const isConfigured = await trimixBase.isConfigured();

    // Get current base position from memory
    const baseStatus = memoryDB.data?.baseStatus || {
      head: 0,
      feet: 0,
      isMoving: false,
      lastUpdate: new Date().toISOString(),
    };

    logger.debug('Getting base status:', { ...baseStatus, isConfigured });
    res.json({ ...baseStatus, isConfigured });
  } catch (error) {
    logger.error('Error getting base status:', error);
    res.status(500).json({ error: 'Failed to get base status' });
  }
});

// POST /api/base-control
router.post('/base-control', async (req, res) => {
  try {
    // Validate request body
    const validatedData = BasePositionSchema.parse(req.body);

    logger.info('Setting base position:', validatedData);

    // Let BLE notifications handle both position and movement status updates
    // No manual state updates needed here

    // Control actual base via BLE
    logger.info('Setting base position via BLE');
    await trimixBase.setPosition({
      head: validatedData.head,
      feet: validatedData.feet,
      feedRate: validatedData.feedRate || 50,
    });

    // Note: Position and movement status will be updated automatically by BLE notifications

    res.json({
      success: true,
      position: validatedData,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    } else {
      logger.error('Error setting base position:', error);
      res.status(500).json({ error: 'Failed to set base position' });
    }
  }
});

// POST /api/base-control/preset
router.post('/base-control/preset', async (req, res): Promise<void> => {
  try {
    const { preset } = req.body as {
      preset: keyof typeof BASE_PRESETS | undefined;
    };

    if (!preset || !BASE_PRESETS[preset]) {
      res.status(400).json({ error: 'Invalid preset' });
      return;
    }

    const position = BASE_PRESETS[preset];

    logger.info(`Setting base to ${preset} preset:`, position);

    // Let BLE notifications handle both position and movement status updates
    // No manual state updates needed here

    // Control actual base via BLE
    logger.info(`Setting base to ${preset} preset via BLE`);
    await trimixBase.setPosition({
      head: position.head,
      feet: position.feet,
      feedRate: position.feedRate || 50,
    });

    // Note: Position and movement status will be updated automatically by BLE notifications

    res.json({
      success: true,
      preset,
      position,
    });
  } catch (error) {
    logger.error('Error setting base preset:', error);
    res.status(500).json({ error: 'Failed to set base preset' });
  }
});

// POST /api/base-control/stop
router.post('/base-control/stop', async (_req, res) => {
  try {
    logger.info('Emergency stop requested');

    // Stop base via BLE
    await trimixBase.stop();
    logger.info('Base movement stopped via BLE');

    // Note: isMoving status will be updated automatically by BLE System Flags packets when motors actually stop

    res.json({ success: true, message: 'Stop command sent' });
  } catch (error) {
    logger.error('Error stopping base:', error);
    res.status(500).json({ error: 'Failed to stop base' });
  }
});

export default router;
