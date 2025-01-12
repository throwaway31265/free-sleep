export const TEMPERATURE_FORMATS = ['celsius', 'fahrenheit'] as const;

export type TemperatureFormat = (typeof TEMPERATURE_FORMATS)[number];