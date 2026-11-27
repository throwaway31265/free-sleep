export function farenheitToCelcius(farenheit: number): number {
  const celcius = (farenheit - 32) * 5 / 9;
  return Math.round(celcius * 2) / 2;
}

export function formatTemperature(temperature: number, celcius: boolean) {
  return celcius ? `${farenheitToCelcius(temperature)}°C` : `${temperature}°F`;
}

/**
 * Formats a temperature difference given in °F (e.g. an autopilot offset).
 * Celsius differences scale by 5/9 without the 32° shift, rounded to 0.5.
 * `signed` prefixes + / − (a true minus sign); otherwise the magnitude is returned.
 */
export function formatTemperatureDelta(deltaF: number, celcius: boolean, signed = true) {
  const magnitude = celcius ? Math.round(Math.abs(deltaF) * 5 / 9 * 2) / 2 : Math.abs(deltaF);
  const sign = !signed || magnitude === 0 ? '' : deltaF < 0 ? '−' : '+';
  return `${sign}${magnitude}°${celcius ? 'C' : 'F'}`;
}

// Formats a sensor reading that is natively in °C (room / bed sensors), one decimal
export function formatCelsiusReading(valueC: number, celcius: boolean) {
  return celcius ? `${valueC.toFixed(1)}°C` : `${(valueC * 9 / 5 + 32).toFixed(1)}°F`;
}


export const MIN_TEMP_F = 55;
export const MAX_TEMP_F = 110;

export const MIN_TEMP_C = farenheitToCelcius(MIN_TEMP_F);
export const MAX_TEMP_C = farenheitToCelcius(MAX_TEMP_F);


// Color stops from coldest to hottest. The bed's neutral point (~82°F) sits between indigo and amber.
const TEMPERATURE_COLOR_STOPS: { tempF: number; rgb: [number, number, number] }[] = [
  { tempF: MIN_TEMP_F, rgb: [56, 189, 248] }, // icy cyan
  { tempF: 70, rgb: [96, 140, 255] }, // cool blue
  { tempF: 82, rgb: [139, 156, 255] }, // neutral indigo
  { tempF: 95, rgb: [251, 160, 84] }, // warm amber
  { tempF: MAX_TEMP_F, rgb: [244, 96, 84] }, // hot coral
];

function rgbToHex([red, green, blue]: [number, number, number]) {
  return `#${[red, green, blue].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

export const COOL_COLOR = '#38bdf8';
export const HOT_COLOR = '#f46054';

/**
 * Maps a temperature to a color on a smooth cool → warm gradient
 * by linearly blending between the two nearest color stops.
 */
export function getTemperatureColor(tempF: number | undefined) {
  if (tempF === undefined) return '#2a3148';
  const clamped = Math.min(MAX_TEMP_F, Math.max(MIN_TEMP_F, tempF));
  const upperIndex = TEMPERATURE_COLOR_STOPS.findIndex(stop => clamped <= stop.tempF);
  if (upperIndex <= 0) return rgbToHex(TEMPERATURE_COLOR_STOPS[0].rgb);
  const lower = TEMPERATURE_COLOR_STOPS[upperIndex - 1];
  const upper = TEMPERATURE_COLOR_STOPS[upperIndex];
  const progress = (clamped - lower.tempF) / (upper.tempF - lower.tempF);
  const blended = lower.rgb.map((channel, index) => Math.round(channel + (upper.rgb[index] - channel) * progress));
  return rgbToHex(blended as [number, number, number]);
}

