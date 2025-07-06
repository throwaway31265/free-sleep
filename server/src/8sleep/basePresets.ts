import type { BasePosition } from '../routes/baseControl/baseControl.js';

export const BASE_PRESETS: Record<'flat' | 'sleep' | 'relax', BasePosition> = {
  flat: { head: 0, feet: 0, feedRate: 50 },
  sleep: { head: 10, feet: 5, feedRate: 50 },
  relax: { head: 30, feet: 15, feedRate: 50 },
};
