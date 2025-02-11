import logger from '../logger.js';
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

export class FrankenMonitor {
    private variableValues = defaultVarValues;
    private franken: Franken | undefined;
    // private networkInfo = DeviceApiNetworkInfo.default;
    private alarmDismiss = defaultAlarmDismiss;
    private doubleTap = defaultDoubleTap;
    private tripleTap = defaultTripleTap;
    private quadTap = defaultQuadTap;

    private isRunning = false;
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
        if (this.franken) {
            this.franken.close();
            this.franken = undefined;
        }
    }

    // private dismissNotification: ((d: { [i: string]: number }) => Promise<void>) | undefined;

    public async dismissNotification(times: { [i: string]: number}) {
        logger.info(`[dismissAlarm] times: ${JSON.stringify(times)}`, "dismiss alarm");
    }
    private async tryNotifyDismiss(dismiss: { [i: string]: number }) {
        if (this.dismissNotification === undefined) return;
        await this.dismissNotification(dismiss);
    }

    private async processAlarmDismiss() {
        await this.processGesture("dismissAlarm", this.alarmDismiss, this.tryNotifyDismiss.bind(this));
    }

    //private doubleTapNotification: ((d: { [i: string]: number }) => Promise<void>) | undefined;
    public async doubleTapNotification(times: { [i: string]: number}) {
        logger.info(`[doubleTap] times: ${JSON.stringify(times)}`, "double tap");
    }
    private async tryNotifyDoubleTap(doubleTap: { [i: string]: number }) {
        if (this.doubleTapNotification === undefined) return;
        await this.doubleTapNotification(doubleTap);
    }

    // private tripleTapNotification: ((d: { [i: string]: number }) => Promise<void>) | undefined;
    public async tripleTapNotification(times: { [i: string]: number}) {
        logger.info(`[tripleTap] times: ${JSON.stringify(times)}`, "triple tap");
    }
    private async tryNotifyTripleTap(tripleTap: { [i: string]: number }) {
        if (this.tripleTapNotification === undefined) return;
        await this.tripleTapNotification(tripleTap);
    }

    // private quadTapNotification: ((d: { [i: string]: number }) => Promise<void>) | undefined;
    public async quadTapNotification(times: { [i: string]: number}) {
        logger.info(`[tripleTap] times: ${JSON.stringify(times)}`, "quad tap");
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
            logger.info(`[processGesture] next: ${next}`, `${variableName} state change`);

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


    private async frankenLoop() {
        while (true) {
            try {
                const franken = await getFranken();
                try {
                    this.franken = franken;

                    while (true) {
                        await wait(1000);

                        const resp = await franken.getVariables();
                        logger.info(`[frankenLoop] resp: ${JSON.stringify(resp)}`, "franken variables");
                        this.variableValues = { ...this.variableValues, ...resp };

                        await this.processAlarmDismiss();
                        await this.processTTC();
                        // await this.updateWaterState(this.variableValues["waterLevel"] == "true");
                        // await this.updatePrimeNeeded(parseInt(this.variableValues["needsPrime"], 10));
                    }
                } finally {
                    franken.close();
                    this.franken = undefined;
                }
            } catch (err) {
                logger.error(err instanceof Error ? err.message : String(err), "franken disconnected");
            }
        }
    }
} 