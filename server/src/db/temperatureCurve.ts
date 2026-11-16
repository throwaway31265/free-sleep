// What each firmware level means as a water temperature. Shared by the server and the app, so it
// must not import anything.
//
// The firmware works in levels from -100 to 100. These are the temperatures it reported aiming
// for at each level on a Pod 5 (published on NATS as `rawmem.frz.therm`): three straight
// stretches, with levels between the points on the straight line between them. Level -100 alone
// is different: it drops to 10°C, "as cold as possible", while -99 is still on the first stretch.
const CURVE_POINTS_C: [level: number, temperatureC: number][] = [
  [-100, 10],
  [-99, 15.12],
  [0, 27],
  [50, 36],
  [100, 42],
];

const celsiusToFahrenheit = (temperatureC: number) => temperatureC * 9 / 5 + 32;
const CURVE_POINTS_F = CURVE_POINTS_C.map(([level, temperatureC]) => [level, celsiusToFahrenheit(temperatureC)]);

export const MIN_FIRMWARE_LEVEL = -100;
export const MAX_FIRMWARE_LEVEL = 100;
// The coldest and hottest whole °F that can be asked for: 50°F and 108°F
export const MIN_TEMPERATURE_F = Math.round(CURVE_POINTS_F[0][1]);
export const MAX_TEMPERATURE_F = Math.round(CURVE_POINTS_F[CURVE_POINTS_F.length - 1][1]);

// Reads a value off a line drawn through points, holding the end values beyond the ends.
// `fromIndex` and `toIndex` pick which column of each point is the input and which the output.
function interpolate(points: number[][], input: number, fromIndex: number, toIndex: number): number {
  if (input <= points[0][fromIndex]) return points[0][toIndex];
  for (let pointIndex = 1; pointIndex < points.length; pointIndex++) {
    const lower = points[pointIndex - 1];
    const upper = points[pointIndex];
    if (input <= upper[fromIndex]) {
      const fraction = (input - lower[fromIndex]) / (upper[fromIndex] - lower[fromIndex]);
      return lower[toIndex] + fraction * (upper[toIndex] - lower[toIndex]);
    }
  }
  return points[points.length - 1][toIndex];
}

// The temperature (°F, not rounded) the firmware aims for at a level
export function levelToTemperatureF(level: number): number {
  return interpolate(CURVE_POINTS_F, level, 0, 1);
}

// The whole firmware level whose temperature is closest to a temperature
export function temperatureFToLevel(temperatureF: number): number {
  // `|| 0` turns -0 into 0
  return Math.round(interpolate(CURVE_POINTS_F, temperatureF, 1, 0)) || 0;
}

// Before the curve was measured, levels were spread evenly over 55-110°F. Converts a whole °F
// saved under that assumption to the whole °F that means the same level now, so a saved schedule
// keeps setting the bed exactly as it did.
const EVEN_SPREAD_NEUTRAL_F = 82.5;
const EVEN_SPREAD_F_PER_LEVEL = 27.5 / 100;
export function convertFromEvenSpreadF(temperatureF: number): number {
  const level = Math.round((temperatureF - EVEN_SPREAD_NEUTRAL_F) / EVEN_SPREAD_F_PER_LEVEL);
  const clampedLevel = Math.min(MAX_FIRMWARE_LEVEL, Math.max(MIN_FIRMWARE_LEVEL, level));
  return Math.round(levelToTemperatureF(clampedLevel));
}
