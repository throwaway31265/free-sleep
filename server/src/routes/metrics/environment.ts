// Room / bed environment samples posted by biometrics/environment/environment_reader.py.
// Kept in memory only (a 60 minute ring), never written to disk.
import express, { Request, Response, Router } from 'express';
import { z } from 'zod';
import logger from '../../logger.js';
import type { Side } from '../../db/schedulesSchema.js';

const router: Router = express.Router();

const RING_SIZE = 120; // 30 s cadence -> 60 min
const GLITCH_JUMP_C = 3;
const GLITCH_COMPARE_WINDOW_MS = 10 * 60 * 1000;

const BedSideSchema = z.object({
  sideC: z.number().nullable(),
  outC: z.number().nullable(),
  cenC: z.number().nullable(),
  inC: z.number().nullable(),
}).partial();

const ThermSideSchema = z.object({
  targetC: z.number().nullable(),
  power: z.number().min(-1).max(1).nullable(),
}).partial();

export const EnvironmentSampleSchema = z.object({
  ts: z.number(),
  ambientC: z.number().nullable().optional(),
  humidity: z.number().nullable().optional(),
  mcuC: z.number().nullable().optional(),
  bed: z.object({
    left: BedSideSchema.nullable().optional(),
    right: BedSideSchema.nullable().optional(),
  }).nullable().optional(),
  therm: z.object({
    left: ThermSideSchema.nullable().optional(),
    right: ThermSideSchema.nullable().optional(),
  }).nullable().optional(),
});

export type EnvironmentPayload = z.infer<typeof EnvironmentSampleSchema>;

export type EnvironmentSample = EnvironmentPayload & {
  receivedAt: number; // epoch ms
  ambientValid: boolean; // false when ambient is missing or jumped like a sensor glitch
};

const ring: EnvironmentSample[] = [];

// Compares ambient to the most recent valid sample from the last 10 minutes
function isAmbientValid(ambientC: number | null | undefined, receivedAt: number): boolean {
  if (ambientC === null || ambientC === undefined) return false;
  for (let index = ring.length - 1; index >= 0; index--) {
    const previous = ring[index];
    if (receivedAt - previous.receivedAt > GLITCH_COMPARE_WINDOW_MS) break;
    if (!previous.ambientValid || previous.ambientC === null || previous.ambientC === undefined) continue;
    return Math.abs(ambientC - previous.ambientC) <= GLITCH_JUMP_C;
  }
  return true;
}

export function addEnvironmentSample(payload: EnvironmentPayload, receivedAt = Date.now()): EnvironmentSample {
  const sample: EnvironmentSample = {
    ...payload,
    receivedAt,
    ambientValid: isAmbientValid(payload.ambientC, receivedAt),
  };
  if (payload.ambientC !== null && payload.ambientC !== undefined && !sample.ambientValid) {
    logger.debug(`[environment] ambient ${payload.ambientC} C looks like a glitch, ignoring it`);
  }
  ring.push(sample);
  if (ring.length > RING_SIZE) ring.splice(0, ring.length - RING_SIZE);
  return sample;
}

export function getEnvironment(now = Date.now()): { sample: EnvironmentSample; ageS: number } | null {
  const sample = ring.at(-1);
  if (!sample) return null;
  return { sample, ageS: Math.max(0, Math.round((now - sample.receivedAt) / 1000)) };
}

// Thermal power samples for a side over the last N minutes, oldest first
export function getThermPowerHistory(side: Side, minutes: number, now = Date.now()): Array<{ receivedAt: number; power: number }> {
  const cutoff = now - minutes * 60 * 1000;
  const history: Array<{ receivedAt: number; power: number }> = [];
  ring.forEach((sample) => {
    const power = sample.therm?.[side]?.power;
    if (sample.receivedAt >= cutoff && typeof power === 'number') {
      history.push({ receivedAt: sample.receivedAt, power });
    }
  });
  return history;
}

router.post('/environment', (req: Request, res: Response) => {
  const validationResult = EnvironmentSampleSchema.safeParse(req.body);
  if (!validationResult.success) {
    logger.warn(`Invalid environment sample: ${validationResult.error.message}`);
    res.status(400).json({
      error: 'Invalid request data',
      details: validationResult.error.errors,
    });
    return;
  }
  addEnvironmentSample(validationResult.data);
  res.status(204).end();
});

router.get('/environment', (req: Request, res: Response) => {
  const environment = getEnvironment();
  res.json({
    latest: environment?.sample ?? null,
    ageSeconds: environment?.ageS ?? null,
  });
});

export default router;
