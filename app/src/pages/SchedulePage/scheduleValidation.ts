// Distinct wall-clock times define a span under 24 hours, including overnight schedules.
export function isPowerScheduleDurationValid(powerOn: string, powerOff: string): boolean {
  const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/;
  return timeFormat.test(powerOn) && timeFormat.test(powerOff) && powerOn !== powerOff;
}
