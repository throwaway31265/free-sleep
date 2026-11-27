import express from 'express';
import { z } from 'zod';
import logger from '../../logger.js';
import settingsDB from '../../db/settings.js';
import { SideSchema } from '../../db/schedulesSchema.js';
import { getEnvironment } from '../metrics/environment.js';
import { getRuntime, pause, readDecisionFile, resume } from '../../autopilot/state.js';
import { DECISION_RING_SIZE } from '../../autopilot/types.js';
const router = express.Router();
const STATUS_DECISION_COUNT = 20;
const PauseBodySchema = z.object({ minutes: z.number().int().min(15).max(720) }).strict();
const LogQuerySchema = z.object({
    side: SideSchema,
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    source: z.enum(['memory', 'file']).optional(),
});
// Per-side status: runtime, the inputs autopilot sees, and the latest decisions
function buildSideStatus(side) {
    const cfg = settingsDB.data[side].autopilot;
    const runtime = getRuntime(side);
    const environment = getEnvironment();
    const sample = environment?.sample;
    return {
        enabled: cfg.enabled,
        mode: cfg.mode,
        state: runtime.state,
        anchorF: runtime.anchorF,
        anchorSource: runtime.anchorSource,
        appliedOffset: runtime.appliedOffset,
        offsetIsVirtual: runtime.offsetIsVirtual,
        lastWrittenF: runtime.lastWrittenF,
        lastWriteAt: runtime.lastWriteAt,
        holdUntil: runtime.holdUntil,
        pausedUntil: runtime.pausedUntil,
        failCount: runtime.failCount,
        writesTonight: runtime.writesTonight,
        inputs: {
            ambientC: sample?.ambientC ?? null,
            humidity: sample?.humidity ?? null,
            envAgeS: environment?.ageS ?? null,
            refC: cfg.room.referenceC ?? runtime.nightRefC,
            bedCenC: sample?.bed?.[side]?.cenC ?? null,
            bedInC: sample?.bed?.[side]?.inC ?? null,
            thermPower: sample?.therm?.[side]?.power ?? null,
            thermTargetC: sample?.therm?.[side]?.targetC ?? null,
        },
        decisions: runtime.log.slice(-STATUS_DECISION_COUNT),
    };
}
// Pause/resume only make sense while enabled; otherwise they would move a disabled side out of OFF
function rejectWhenDisabled(side, res) {
    if (settingsDB.data[side].autopilot.enabled)
        return false;
    res.status(409).json({ error: `Autopilot is disabled on the ${side} side` });
    return true;
}
router.get('/autopilot/status', async (req, res) => {
    await settingsDB.read();
    res.json({
        left: buildSideStatus('left'),
        right: buildSideStatus('right'),
    });
});
router.get('/autopilot/log', async (req, res) => {
    const validationResult = LogQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
        res.status(400).json({ error: 'Invalid query', details: validationResult.error.errors });
        return;
    }
    const { side, source } = validationResult.data;
    const limit = validationResult.data.limit ?? DECISION_RING_SIZE;
    if (source === 'file') {
        res.json(await readDecisionFile(side, limit));
        return;
    }
    res.json(getRuntime(side).log.slice(-limit));
});
router.post('/autopilot/:side/pause', (req, res) => {
    const sideResult = SideSchema.safeParse(req.params.side);
    const bodyResult = PauseBodySchema.safeParse(req.body);
    if (!sideResult.success || !bodyResult.success) {
        res.status(400).json({ error: 'Invalid request data', details: bodyResult.error?.errors ?? sideResult.error?.errors });
        return;
    }
    if (rejectWhenDisabled(sideResult.data, res))
        return;
    pause(sideResult.data, bodyResult.data.minutes);
    logger.info(`[autopilot] ${sideResult.data}: paused for ${bodyResult.data.minutes} min`);
    res.json(buildSideStatus(sideResult.data));
});
router.post('/autopilot/:side/resume', (req, res) => {
    const sideResult = SideSchema.safeParse(req.params.side);
    if (!sideResult.success) {
        res.status(400).json({ error: 'Invalid side', details: sideResult.error.errors });
        return;
    }
    if (rejectWhenDisabled(sideResult.data, res))
        return;
    resume(sideResult.data);
    logger.info(`[autopilot] ${sideResult.data}: resumed`);
    res.json(buildSideStatus(sideResult.data));
});
export default router;
//# sourceMappingURL=autopilot.js.map