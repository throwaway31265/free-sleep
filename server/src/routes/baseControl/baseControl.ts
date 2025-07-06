import express from 'express';
import { z } from 'zod';
import { executeFunction } from '../../8sleep/deviceApi.js';
import logger from '../../logger.js';
import memoryDB from '../../db/memoryDB.js';
import { trimixBase } from '../../8sleep/trimixBaseControl.js';

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

    // Try to control actual base via BLE
    try {
      logger.info('Attempting to control actual base via BLE');
      await trimixBase.setPosition({
        head: validatedData.head,
        feet: validatedData.feet,
        feedRate: validatedData.feedRate || 50,
      });

      // Movement takes time, estimate based on angle change
      const estimatedTime = Math.max(
        Math.abs((memoryDB.data?.baseStatus?.head || 0) - validatedData.head) *
          200,
        Math.abs((memoryDB.data?.baseStatus?.feet || 0) - validatedData.feet) *
          200,
        3000, // Minimum 3 seconds
      );

      setTimeout(async () => {
        logger.info('Base movement completed');
        if (memoryDB.data?.baseStatus) {
          memoryDB.data.baseStatus.isMoving = false;
          await memoryDB.write();
        }
      }, estimatedTime);
    } catch (bleError) {
      logger.error('BLE control failed, falling back to simulation:', bleError);

      // Fallback to simulation
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
      }, 5000);
    }

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

    // Try to control actual base via BLE
    try {
      logger.info(`Setting base to ${preset} preset via BLE`);
      await trimixBase.setPosition({
        head: position.head,
        feet: position.feet,
        feedRate: position.feedRate || 50,
      });

      // Movement takes time, estimate based on angle change
      const estimatedTime = Math.max(
        Math.abs((memoryDB.data?.baseStatus?.head || 0) - position.head) * 200,
        Math.abs((memoryDB.data?.baseStatus?.feet || 0) - position.feet) * 200,
        3000, // Minimum 3 seconds
      );

      setTimeout(async () => {
        logger.info(`Base preset ${preset} movement completed`);
        if (memoryDB.data?.baseStatus) {
          memoryDB.data.baseStatus.isMoving = false;
          await memoryDB.write();
        }
      }, estimatedTime);
    } catch (bleError) {
      logger.error(
        'BLE preset control failed, falling back to simulation:',
        bleError,
      );

      // Fallback to simulation
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
    }

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

    // Try to stop via BLE
    try {
      await trimixBase.stop();
      logger.info('Base movement stopped via BLE');
    } catch (bleError) {
      logger.error('Failed to stop base via BLE:', bleError);
    }

    // Always update status
    if (memoryDB.data) {
      if (memoryDB.data.baseStatus) {
        memoryDB.data.baseStatus.isMoving = false;
        await memoryDB.write();
      }
    }

    res.json({ success: true, message: 'Stop command sent' });
  } catch (error) {
    logger.error('Error stopping base:', error);
    res.status(500).json({ error: 'Failed to stop base' });
  }
});

export default router;
