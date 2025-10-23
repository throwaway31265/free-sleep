import { StatusInfo, ServerStatus as ServerStatusType } from './routes/serverStatus/serverStatusSchema.js';


class ServerStatus {
  // eslint-disable-next-line no-use-before-define
  private static instance: ServerStatus;
  public alarmSchedule: StatusInfo;
  public express: StatusInfo;
  public franken: StatusInfo;
  public jobs: StatusInfo;
  public logger: StatusInfo;
  public powerSchedule: StatusInfo;
  public primeSchedule: StatusInfo;
  public rebootSchedule: StatusInfo;
  public systemDate: StatusInfo;
  public temperatureSchedule: StatusInfo;

  private constructor() {
    this.alarmSchedule = {
      name: 'Alarm schedule',
      status: 'not_started',
      description: '',
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

  public static getInstance(): ServerStatus {
    if (!ServerStatus.instance) {
      ServerStatus.instance = new ServerStatus();
    }
    return ServerStatus.instance;
  }

  public toJSON(): ServerStatusType {
    return {
      alarmSchedule: this.alarmSchedule,
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
