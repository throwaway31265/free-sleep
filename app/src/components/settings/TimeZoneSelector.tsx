import type { Settings } from '@api/settingsSchema.ts';
import { TIME_ZONES } from '@api/timeZones.ts';
import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import { useAppStore } from '@state/appStore.tsx';
import type { DeepPartial } from 'ts-essentials';

type TimeZoneSelectorProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

export default function TimeZoneSelector({
  settings,
  updateSettings,
}: TimeZoneSelectorProps) {
  const { isUpdating } = useAppStore();

  const handleChange = (event: SelectChangeEvent) => {
    updateSettings({
      timeZone: event.target.value as Settings['timeZone'],
    });
  };

  return (
    <Box sx={{ minWidth: 200, width: { xs: '100%', sm: 320 } }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
        Time Zone
      </Typography>
      <FormControl fullWidth>
        <InputLabel>Select your time zone</InputLabel>
        <Select
          error={settings?.timeZone === null}
          disabled={isUpdating}
          value={settings?.timeZone || ''}
          label="Select your time zone"
          onChange={handleChange}
        >
          {TIME_ZONES.map((zone) => (
            <MenuItem value={zone} key={zone}>
              {zone}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {settings?.timeZone === null && (
        <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
          Please select a time zone for accurate scheduling
        </Typography>
      )}
    </Box>
  );
}
