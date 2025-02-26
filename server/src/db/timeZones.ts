export const TIME_ZONES = [
  'UTC', // Coordinated Universal Time
  'America/Anchorage', // Alaska
  'America/Los_Angeles', // Pacific Time (US & Canada)
  'Pacific/Honolulu', // Hawaii
  'America/Denver', // Mountain Time (US & Canada)
  'America/Chicago', // Central Time (US & Canada)
  'America/New_York', // Eastern Time (US & Canada)
  'America/Sao_Paulo', // Brazil
  'Atlantic/Reykjavik', // Iceland
  'Europe/London', // UK
  'Europe/Berlin', // Central European Time
  'Europe/Moscow', // Moscow Time
  'Africa/Lagos', // West Africa Time
  'Africa/Johannesburg', // South Africa Time
  'Asia/Dubai', // Gulf Standard Time
  'Asia/Kolkata', // India Standard Time
  'Asia/Shanghai', // China Standard Time
  'Asia/Tokyo', // Japan Standard Time
  'Australia/Sydney', // New South Wales
  'Australia/Brisbane', // Queensland
  'Pacific/Auckland', // New Zealand
] as const;

// eslint-disable-next-line @typescript-eslint/no-type-alias
export type TimeZone = typeof TIME_ZONES[number];