import { PrismaClient } from '@prisma/client';
import { isSystemDateValid } from './jobs/isSystemDateValid.js';
const prisma = new PrismaClient();
class ServerStatus {
    // eslint-disable-next-line no-use-before-define
    static instance;
    alarmSchedule;
    database;
    express;
    franken;
    jobs;
    logger;
    powerSchedule;
    primeSchedule;
    rebootSchedule;
    systemDate;
    temperatureSchedule;
    constructor() {
        this.alarmSchedule = {
            name: 'Alarm schedule',
            status: 'not_started',
            description: '',
            message: '',
        };
        this.database = {
            name: 'Database',
            status: 'not_started',
            description: 'Connection to SQLite DB',
            message: '',
        };
        this.express = {
            name: 'Express',
            status: 'not_started',
            description: 'The back-end server',
            message: ''
        };
        this.franken = {
            name: 'Franken sock',
            status: 'not_started',
            description: 'Socket service for controlling the hardware',
            message: '',
        };
        this.jobs = {
            name: 'Job scheduler',
            status: 'not_started',
            description: 'Scheduling service for temperature changes, alarms, and maintenance',
            message: '',
        };
        this.logger = {
            name: 'Logger',
            status: 'not_started',
            description: 'Logging service',
            message: '',
        };
        this.powerSchedule = {
            name: 'Power schedule',
            status: 'not_started',
            description: 'Power on/off schedule',
            message: '',
        };
        this.primeSchedule = {
            name: 'Prime schedule',
            status: 'not_started',
            description: 'Daily prime job',
            message: '',
        };
        this.rebootSchedule = {
            name: 'Reboot schedule',
            status: 'not_started',
            description: 'Daily system reboots',
            message: '',
        };
        this.systemDate = {
            name: 'System date',
            status: 'not_started',
            description: 'Whether or not the system date is correct. Scheduling jobs depend on this.',
            message: ''
        };
        this.temperatureSchedule = {
            name: 'Temperature schedule',
            status: 'not_started',
            description: 'Temperature adjustment schedule',
            message: '',
        };
    }
    static getInstance() {
        if (!ServerStatus.instance) {
            ServerStatus.instance = new ServerStatus();
        }
        return ServerStatus.instance;
    }
    async updateDB() {
        try {
            await prisma.$queryRaw `SELECT 1`;
            this.database.status = 'healthy';
            this.database.message = '';
        }
        catch (error) {
            this.database.status = 'failed';
            const message = error instanceof Error ? error.message : String(error);
            this.database.message = message;
        }
    }
    updateSystemDate() {
        const isValid = isSystemDateValid();
        if (isValid) {
            this.systemDate.status = 'healthy';
            this.systemDate.message = '';
        }
        else {
            this.systemDate.status = 'failed';
            this.systemDate.message = `Invalid system date: ${new Date().toISOString()}`;
        }
    }
    async toJSON() {
        await this.updateDB();
        this.updateSystemDate();
        return {
            alarmSchedule: this.alarmSchedule,
            database: this.database,
            express: this.express,
            franken: this.franken,
            jobs: this.jobs,
            logger: this.logger,
            powerSchedule: this.powerSchedule,
            primeSchedule: this.primeSchedule,
            rebootSchedule: this.rebootSchedule,
            systemDate: this.systemDate,
            temperatureSchedule: this.temperatureSchedule,
        };
    }
}
export default ServerStatus.getInstance();
