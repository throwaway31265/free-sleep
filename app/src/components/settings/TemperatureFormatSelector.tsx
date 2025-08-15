import { type Settings, TEMPERATURES } from '@api/settingsSchema.ts';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useAppStore } from '@state/appStore.tsx';
import type { DeepPartial } from 'ts-essentials';

type TemperatureFormatSelectorProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

export default function TemperatureFormatSelector({
  settings,
  updateSettings,
}: TemperatureFormatSelectorProps) {
  const { isUpdating } = useAppStore();

  const handleChange = (
    _: React.MouseEvent<HTMLElement>,
    newFormat: string,
  ) => {
    if (newFormat !== null) {
      updateSettings({
        temperatureFormat: newFormat as Settings['temperatureFormat'],
      });
    }
  };

  return (
    <Box sx={{ minWidth: 200 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
        Temperature Units
      </Typography>
      <ToggleButtonGroup
        disabled={isUpdating}
        color="primary"
        value={settings?.temperatureFormat || 'fahrenheit'}
        exclusive
        onChange={handleChange}
        fullWidth
      >
        {TEMPERATURES.map((format) => (
          <ToggleButton value={format} key={format} sx={{ textTransform: 'capitalize' }}>
            {format === 'fahrenheit' ? 'Fahrenheit (°F)' : 'Celsius (°C)'}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
