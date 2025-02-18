import fs from 'fs';
import cbor from 'cbor';
import logger from '../logger.js';
import settingsDB from '../db/settings.js';
import { executeFunction } from './deviceApi.js';
import { getFranken } from './frankenServer.js';
import { wait } from './promises.js';

const defaultAlarmDismiss: { [i: string]: number } = {};
const defaultDoubleTap: { [i: string]: number } = {};
const defaultTripleTap: { [i: string]: number } = {};
const defaultQuadTap: { [i: string]: number } = {};

const defaultVarValues: { [i: string]: string } = {
    sensorLabel: "null",
    leftPillowLabel: "null",
    rightPillowLabel: "null",
    waterLevel: "true",
    priming: "false",
    updating: "false",
    settings: "null",

    heatLevelL: "10",
    heatLevelR: "10",
    tgHeatLevelL: "10",
    tgHeatLevelR: "10",
    heatTimeL: "0",
    heatTimeR: "0",
    dismissAlarm: JSON.stringify(defaultAlarmDismiss),
    doubleTap: JSON.stringify(defaultDoubleTap),
    tripleTap: JSON.stringify(defaultTripleTap),
    quadTap: JSON.stringify(defaultQuadTap),
    needsPrime: "0",
};

const DEFAULT_SNOOZE_MINUTES = 9;
const MIN_SNOOZE_MINUTES = 1;
const MAX_SNOOZE_MINUTES = 10;

export class FrankenMonitor {
    private variableValues = defaultVarValues;
    // private networkInfo = DeviceApiNetworkInfo.default;
    private alarmDismiss = defaultAlarmDismiss;
    private doubleTap = defaultDoubleTap;
    private tripleTap = defaultTripleTap;
    private quadTap = defaultQuadTap;

    private isRunning = false;
    private wasPriming = false;

    // private monitorInterval = 1000; // 1 second interval

    public async start() {
        if (this.isRunning) {
            logger.warn('FrankenMonitor is already running');
            return;
        }

        this.isRunning = true;
        // monitorLoop
        this.frankenLoop().catch(err => {
            logger.error(err instanceof Error ? err.message : String(err), 'Error in FrankenMonitor loop');
            this.isRunning = false;
        });
    }

    public stop() {
        this.isRunning = false;
    
    }

    // private dismissNotification: ((d: { [i: string]: number }) => Promise<void>) | undefined;

    public async dismissNotification(times: { [i: string]: number}, snooze: boolean = false) {
        logger.info(`[dismissAlarm] times: ${JSON.stringify(times)} snooze: ${snooze}`);
        if (snooze) {
            try {
                // Determine which side was most recently active
                const leftTime = times['l'] || 0;
                const rightTime = times['r'] || 0;
                const side = leftTime > rightTime ? 'left' : 'right';

                // Read existing alarm settings using CBOR decoding
                const alarmBytes = fs.readFileSync('/persistent/alarm.cbr');
                const alarmData = cbor.decode(alarmBytes);
                logger.debug(`Decoded alarm data: ${JSON.stringify(alarmData)}`, "alarm data");

                // Access the side data
                const sideData = alarmData[side];
                if (!sideData || typeof sideData !== 'object') {
                    throw new Error(`Invalid alarm data for ${side} side`);
                }

                // Validate snooze minutes
                if (DEFAULT_SNOOZE_MINUTES < MIN_SNOOZE_MINUTES || DEFAULT_SNOOZE_MINUTES > MAX_SNOOZE_MINUTES) {
                    throw new Error("Snooze minutes must be between 1 and 10");
                }

                // Calculate snooze time
                const snoozeTime = Math.floor(Date.now() / 1000) + (DEFAULT_SNOOZE_MINUTES * 60);

                // Create alarm payload using existing settings
                const alarmPayload = {
                    pl: sideData.pl,
                    du: sideData.du,
                    tt: snoozeTime,
                    pi: sideData.pi
                };

                const cborPayload = cbor.encode(alarmPayload);
                const hexPayload = cborPayload.toString('hex');
                const command = side === 'left' ? 'ALARM_LEFT' : side === 'right' ? 'ALARM_RIGHT' : 'ALARM_SOLO';

                logger.info(`Setting snooze alarm for ${side} side in ${DEFAULT_SNOOZE_MINUTES} minutes with pattern ${alarmPayload.pi} (payload: ${JSON.stringify(alarmPayload)})`);
                await executeFunction(command, hexPayload);
            } catch (error) {
                logger.error(`Failed to snooze alarm: ${error instanceof Error ? error.message : String(error)}`);
                // On error, just clear the alarm
                await executeFunction('ALARM_CLEAR', "empty");
            }
        } else {
            await executeFunction('ALARM_CLEAR', "empty");
        }
    }

    private async tryNotifyDismiss(dismiss: { [i: string]: number }) {
        if (this.dismissNotification === undefined) return;
        await this.dismissNotification(dismiss, true); // TODO: Get user preference for snooze
    }

    private async processAlarmDismiss() {
        await this.processGesture("dismissAlarm", this.alarmDismiss, this.tryNotifyDismiss.bind(this));
    }

    //private doubleTapNotification: ((d: { [i: string]: number }) => Promise<void>) | undefined;
    public async doubleTapNotification(times: { [i: string]: number}) {
        // Determine which side was tapped by checking which timestamp is newer
        const leftTime = times['l'] || 0;
        const rightTime = times['r'] || 0;
        
        // Get the side that was most recently tapped
        const tappedSide = leftTime > rightTime ? 'left' : 'right';
        const currentLevel = parseInt(tappedSide === 'left' ? this.variableValues.heatLevelL : this.variableValues.heatLevelR);
        
        // Decrease by 10 (one level)
        const newLevel = Math.max(0, currentLevel - 10).toString();

        logger.debug(`[doubleTap] times: ${JSON.stringify(times)} | side: ${tappedSide} | currentLevel: ${currentLevel} | newLevel: ${newLevel}`, "double tap");
        
        // Only update the tapped side
        if (tappedSide === 'left') {
            await executeFunction('TEMP_LEVEL_LEFT', newLevel);
        } else {
            await executeFunction('TEMP_LEVEL_RIGHT', newLevel);
        }
    }
    private async tryNotifyDoubleTap(doubleTap: { [i: string]: number }) {
        if (this.doubleTapNotification === undefined) return;
        await this.doubleTapNotification(doubleTap);
    }

    // private tripleTapNotification: ((d: { [i: string]: number }) => Promise<void>) | undefined;
    public async tripleTapNotification(times: { [i: string]: number}) {
        // Determine which side was tapped by checking which timestamp is newer
        const leftTime = times['l'] ?? 0;
        const rightTime = times['r'] ?? 0;
        
        // Get the side that was most recently tapped
        const tappedSide = leftTime > rightTime ? 'left' : 'right';
        const currentLevel = parseInt(tappedSide === 'left' ? this.variableValues.heatLevelL : this.variableValues.heatLevelR);
        
        // Increase by 10 (one level)
        const newLevel = Math.min(100, currentLevel + 10).toString();

        logger.debug(`[tripleTap] times: ${JSON.stringify(times)} | side: ${tappedSide} | currentLevel: ${currentLevel} | newLevel: ${newLevel}`, "triple tap");
        
        // Only update the tapped side
        if (tappedSide === 'left') {
            await executeFunction('TEMP_LEVEL_LEFT', newLevel);
        } else {
            await executeFunction('TEMP_LEVEL_RIGHT', newLevel);
        }
    }
    private async tryNotifyTripleTap(tripleTap: { [i: string]: number }) {
        if (this.tripleTapNotification === undefined) return;
        await this.tripleTapNotification(tripleTap);
    }

    // private quadTapNotification: ((d: { [i: string]: number }) => Promise<void>) | undefined;
    public async quadTapNotification(times: { [i: string]: number}) {
        logger.debug(`[quadTap] times: ${JSON.stringify(times)}`, "quad tap");
    }
    private async tryNotifyQuadTap(quadTap: { [i: string]: number }) {
        if (this.quadTapNotification === undefined) return;
        await this.quadTapNotification(quadTap);
    }

    private async processTTC() {
        await this.processGesture("doubleTap", this.doubleTap, this.tryNotifyDoubleTap.bind(this));
        await this.processGesture("tripleTap", this.tripleTap, this.tryNotifyTripleTap.bind(this));
        await this.processGesture("quadTap", this.quadTap, this.tryNotifyQuadTap.bind(this));
    }

    private async processGesture(
        variableName: string,
        currentState: { [i: string]: number },
        notifyUpdate: (diff: { [i: string]: number }) => Promise<void>
    ) {
        if (Object.keys(currentState).length === 0) {
            Object.assign(currentState, JSON.parse(this.variableValues[variableName]));
            return;
        }

        const current = currentState;
        const next = JSON.parse(this.variableValues[variableName]);
        if (next.l > current.l || next.r > current.r || next.s > current.s) {
            logger.debug(`[processGesture] next: ${JSON.stringify(next)}`, `${variableName} state change`);

            const diff: { [i: string]: number } = {};
            Object.keys(next).forEach((key) => {
                if (next[key] > current[key]) diff[key] = next[key];
            });

            if (Object.keys(diff).length > 0) {
                await notifyUpdate(diff);
            }

            Object.assign(currentState, next);
        }
    }

    private async processPrimingState() {
        const isPriming = this.variableValues.priming === 'true';

        if (!isPriming && this.wasPriming) {
            this.wasPriming = false;
            settingsDB.data.lastPrime = new Date().toISOString();
            await settingsDB.write();
            logger.info('[processPrimingState] Priming completed successfully');
        } else if (isPriming && !this.wasPriming) {
            this.wasPriming = true;
            logger.info('[processPrimingState] Priming started');
        }
    }

    private async frankenLoop() {
        while (true) {
            try {
                const franken = await getFranken();

                while (true) {
                    await wait(1000);

                    const resp = await franken.getVariables();
                    // logger.info(`[frankenLoop] resp: ${JSON.stringify(resp)}`, "franken variables");
                    this.variableValues = { ...this.variableValues, ...resp };

                    await this.processAlarmDismiss();
                    await this.processTTC();
                    await this.processPrimingState();
                    // await this.updateWaterState(this.variableValues["waterLevel"] == "true");
                    // await this.updatePrimeNeeded(parseInt(this.variableValues["needsPrime"], 10));
                }
            } catch (err) {
                logger.error(err instanceof Error ? err.message : String(err), "franken disconnected");
            }
        }
    }
} 