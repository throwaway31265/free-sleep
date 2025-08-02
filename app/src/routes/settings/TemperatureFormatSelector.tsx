import { type Settings, TEMPERATURES } from '@api/settingsSchema.ts';
import Box from '@mui/material/Box';
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
    <Box sx={{ minWidth: 120 }}>
      <ToggleButtonGroup
        disabled={isUpdating}
        color="primary"
        value={settings?.temperatureFormat || 'farenheit'}
        exclusive
        onChange={handleChange}
      >
        {TEMPERATURES.map((format) => (
          <ToggleButton value={format} key={format}>
            {format}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
