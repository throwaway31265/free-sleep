import express from 'express';
import moment from 'moment-timezone';
import { sleepRecordSchema } from '../../db/sleepRecordsSchema.js';
import { loadSleepRecords } from '../../db/loadSleepRecords.js';
import { prisma } from '../../db/prisma.js';
const router = express.Router();
router.get('/sleep', async (req, res) => {
    const { startTime, endTime, side } = req.query;
    const query = {
        entered_bed_at: {},
        left_bed_at: {},
    };
    if (side)
        query.side = side;
    if (startTime) {
        query.left_bed_at = {
            gte: moment(startTime).unix(),
        };
    }
    if (endTime) {
        query.entered_bed_at = {
            lte: moment(endTime).unix(),
        };
    }
    const sleepRecords = await prisma.sleep_records.findMany({
        where: query,
        orderBy: { entered_bed_at: 'asc' },
    });
    const formattedRecords = await loadSleepRecords(sleepRecords);
    res.json(formattedRecords);
});
router.put('/sleep/:id', async (req, res) => {
    const { id } = req.params;
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }
    // Fetch the existing record
    let existingRecord = await prisma.sleep_records.findUnique({
        where: { id: parsedId },
    });
    if (!existingRecord) {
        return res.status(404).json({ error: 'Sleep record not found' });
    }
    const loadedRecords = await loadSleepRecords([existingRecord]);
    // @ts-ignore
    existingRecord = loadedRecords[0];
    // Validate the request body
    const parsedData = sleepRecordSchema.partial().safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({ error: 'Invalid request body', details: parsedData.error.format() });
    }
    // Convert entered_bed_at and exited_bed_at to epoch timestamps
    const updatedRecord = { ...parsedData.data };
    if (updatedRecord.entered_bed_at) {
        // @ts-expect-error
        updatedRecord.entered_bed_at = Math.floor(new Date(updatedRecord.entered_bed_at).getTime() / 1000);
    }
    if (updatedRecord.left_bed_at) {
        // @ts-expect-error
        updatedRecord.left_bed_at = Math.floor(new Date(updatedRecord.left_bed_at).getTime() / 1000);
    }
    // Need to recalculate the number of times someone left the bed during the new sleep interval
    if (updatedRecord.entered_bed_at && updatedRecord.left_bed_at) {
        // @ts-expect-error
        updatedRecord.sleep_period_seconds = updatedRecord.left_bed_at - updatedRecord.entered_bed_at;
        // @ts-expect-error
        updatedRecord.times_exited_bed = existingRecord.not_present_intervals.filter(([start, end]) => {
            const startTime = Math.floor(new Date(start).getTime() / 1000);
            const endTime = Math.floor(new Date(end).getTime() / 1000);
            // @ts-ignore
            return startTime >= updatedRecord.entered_bed_at && endTime <= updatedRecord.left_bed_at;
        }).length;
    }
    // Update the record in the database
    const dbUpdatedRecord = await prisma.sleep_records.update({
        where: { id: parsedId },
        // @ts-ignore
        data: updatedRecord,
    });
    // Load and return the updated record
    const loadedNewRecord = await loadSleepRecords([dbUpdatedRecord]);
    return res.json(loadedNewRecord[0]);
});
router.delete('/sleep/:id', async (req, res) => {
    const { id } = req.params;
    await prisma.sleep_records.delete({ where: { id: parseInt(id, 10) } });
    res.status(204).send();
});
export default router;
//# sourceMappingURL=sleep.js.map