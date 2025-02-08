import { Side } from './schedulesSchema.js';

export interface VitalRecord {
  id: number;
  side: Side;
  period_start: string;
  heart_rate: number;
  hrv: number;
  breathing_rate: number;
}


export interface SleepRecord {
  id: number;
  side: "left" | "right";
  entered_bed_at: string;
  left_bed_at: string;
  sleep_period_seconds: number;
  times_exited_bed: number;
  present_intervals: [string, string][];
  not_present_intervals: [string, string][];
}


