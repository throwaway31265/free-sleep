import { StatusInfo, ServerStatus as ServerStatusType } from './routes/serverStatus/serverStatusSchema.js';


class ServerStatus {
  // eslint-disable-next-line no-use-before-define
  private static instance: ServerStatus;
  public franken: StatusInfo;
  public jobs: StatusInfo;
  public systemDate: StatusInfo;
  public express: StatusInfo;
  public logger: StatusInfo;

  private constructor() {
    this.franken = {
      status: 'not_started',
      description: 'Socket service for controlling the hardware',
      message: '',
    };
    this.jobs = {
      status: 'not_started',
      description: 'Scheduling service for temperature changes, alarms, and maintenance',
      message: '',
    };
    this.systemDate = {
      status: 'not_started',
      description: 'Whether or not the system date is correct',
      message: ''
    };
    this.express = {
      status: 'not_started',
      description: 'The back-end server',
      message: ''
    };
    this.logger = {
      status: 'not_started',
      description: 'Logging service',
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
      franken: this.franken,
      jobs: this.jobs,
      systemDate: this.systemDate,
      express: this.express,
      logger: this.logger,
    };
  }
}

export default ServerStatus.getInstance();
