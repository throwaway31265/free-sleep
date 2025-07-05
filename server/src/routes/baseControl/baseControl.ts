import express from 'express';
import { z } from 'zod';
import { executeFunction } from '../../8sleep/deviceApi.js';
import logger from '../../logger.js';
import memoryDB from '../../db/memoryDB.js';

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
    // Get current base position from memory
    const baseStatus = memoryDB.data?.baseStatus || {
      head: 0,
      feet: 0,
      isMoving: false,
      lastUpdate: new Date().toISOString(),
    };

    logger.debug('Getting base status:', baseStatus);
    res.json(baseStatus);
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

    // Store the target position
    if (memoryDB.data) {
      memoryDB.data.baseStatus = {
        head: validatedData.head,
        feet: validatedData.feet,
        isMoving: true,
        lastUpdate: new Date().toISOString(),
      };
      await memoryDB.write();
    }

    // Note: In a real implementation, this would communicate with the actual
    // adjustable base via BLE. For now, we're just storing the state.
    // The actual BLE communication would need to be implemented similar to
    // how the capybara source handles it via the TriMix BedFrame class.

    logger.warn('Base control is currently simulated - no actual hardware control implemented');
    logger.debug('Would send to base:', {
      feedRate: validatedData.feedRate,
      torsoAngle: validatedData.head,
      legAngle: validatedData.feet,
    });

    const baseControlArg = JSON.stringify({
      feedRate: validatedData.feedRate,
      torsoAngle: validatedData.head,
      legAngle: validatedData.feet,
    });

    await executeFunction('SET_BASE_POSITION', baseControlArg);

    // Simulate movement completion after a delay
    setTimeout(async () => {
      logger.debug('Simulating movement completion');
      if (memoryDB.data?.baseStatus) {
        memoryDB.data.baseStatus.isMoving = false;
        await memoryDB.write();
        logger.info('Base movement simulation completed');
      }
    }, 5000); // 5 seconds to simulate movement

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
router.post('/base-control/preset', async (req, res) => {
  try {
    const { preset } = req.body;

    const presets: Record<string, BasePosition> = {
      flat: { head: 0, feet: 0, feedRate: 50 },
      sleep: { head: 10, feet: 5, feedRate: 50 },
      relax: { head: 30, feet: 15, feedRate: 50 },
    };

    if (!presets[preset]) {
      return res.status(400).json({ error: 'Invalid preset' });
    }

    const position = presets[preset];

    logger.info(`Setting base to ${preset} preset:`, position);

    if (memoryDB.data) {
      memoryDB.data.baseStatus = {
        head: position.head,
        feet: position.feet,
        isMoving: true,
        lastUpdate: new Date().toISOString(),
      };
      await memoryDB.write();
    }

    logger.warn('Base control preset is currently simulated - no actual hardware control');
    logger.debug('Would send preset to base:', {
      preset,
      feedRate: position.feedRate,
      torsoAngle: position.head,
      legAngle: position.feet,
    });

    const baseControlArg = JSON.stringify({
      feedRate: position.feedRate,
      torsoAngle: position.head,
      legAngle: position.feet,
    });

    await executeFunction('SET_BASE_POSITION', baseControlArg);

    // Simulate movement completion
    setTimeout(async () => {
      logger.debug('Simulating preset movement completion');
      if (memoryDB.data?.baseStatus) {
        memoryDB.data.baseStatus.isMoving = false;
        await memoryDB.write();
        logger.info(`Base preset ${preset} simulation completed`);
      }
    }, 5000);

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

export default router;
