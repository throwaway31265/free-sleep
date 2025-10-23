// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/
export type Status =
  'failed' |
  'healthy' |
  'not_started' |
  'restarting' |
  'retrying' |
  'started';

export type StatusInfo = {
  name: string;
  status: Status;
  description: string;
  message: string;
}

export type ServerStatus = {
  alarmSchedule: StatusInfo;
  database: StatusInfo;
  express: StatusInfo;
  franken: StatusInfo;
  jobs: StatusInfo;
  logger: StatusInfo;
  powerSchedule: StatusInfo;
  primeSchedule: StatusInfo;
  rebootSchedule: StatusInfo;
  systemDate: StatusInfo;
  temperatureSchedule: StatusInfo;
};
