// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/
export type Status =
  'not_started' |
  'started' |
  'restarting' |
  'retrying' |
  'failed' |
  'healthy';

export type StatusInfo = {
  status: Status;
  description: string;
  message: string;
}

export type ServerStatus = {
  franken: StatusInfo;
  jobs: StatusInfo;
  systemDate: StatusInfo;
  express: StatusInfo;
  logger: StatusInfo;
};
