class ServerStatus {
    // eslint-disable-next-line no-use-before-define
    static instance;
    franken;
    jobs;
    systemDate;
    express;
    logger;
    constructor() {
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
    static getInstance() {
        if (!ServerStatus.instance) {
            ServerStatus.instance = new ServerStatus();
        }
        return ServerStatus.instance;
    }
    toJSON() {
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
