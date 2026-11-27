// Heart-rate inputs for the experimental sleep rule. Only queried when vitals.enabled is on.
import { prisma } from '../db/prisma.js';
const BASELINE_WINDOW_S = 60 * 60;
const RECENT_WINDOW_S = 20 * 60;
function median(values) {
    if (values.length === 0)
        return null;
    const sorted = [...values].sort((first, second) => first - second);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}
async function loadHeartRates(side, startS, endS) {
    return prisma.vitals.findMany({
        where: { side, timestamp: { gte: startS, lte: endS }, heart_rate: { gt: 0 } },
        select: { timestamp: true, heart_rate: true },
        orderBy: { timestamp: 'asc' },
    });
}
/**
 * Median heart rate for the first hour after power-on (baseline) and the last 20 minutes (recent).
 * Uses the raw epoch-second timestamp column.
 */
export async function loadVitalsInput(side, powerOnMs, now) {
    const powerOnS = Math.floor(powerOnMs / 1000);
    const nowS = Math.floor(now / 1000);
    const [baseRows, recentRows] = await Promise.all([
        loadHeartRates(side, powerOnS, powerOnS + BASELINE_WINDOW_S),
        loadHeartRates(side, nowS - RECENT_WINDOW_S, nowS),
    ]);
    const baseRates = baseRows.map((row) => row.heart_rate);
    const recentRates = recentRows.map((row) => row.heart_rate);
    const newest = recentRows.at(-1);
    return {
        baselineHR: median(baseRates),
        recentHR: median(recentRates),
        newestAgeS: newest ? nowS - newest.timestamp : null,
        nBase: baseRates.length,
        nRecent: recentRates.length,
    };
}
//# sourceMappingURL=vitals.js.map