import type { AlarmButtonBehavior, Settings } from '@api/settingsSchema.ts';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import type { DeepPartial } from 'ts-essentials';

type AlarmButtonBehaviorProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

export default function AlarmButtonBehaviorSelector({
  settings,
  updateSettings,
}: AlarmButtonBehaviorProps) {
  const { isUpdating } = useAppStore();

  const handleChange = (
    _event: React.MouseEvent<HTMLElement>,
    newValue: AlarmButtonBehavior | null,
  ) => {
    if (newValue !== null) {
      updateSettings({ alarmButtonBehavior: newValue });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        Alarm Button Behavior
      </Typography>
      <ToggleButtonGroup
        value={settings?.alarmButtonBehavior || 'dismiss'}
        exclusive
        onChange={handleChange}
        disabled={isUpdating}
        sx={{ width: 'fit-content' }}
      >
        <ToggleButton value="dismiss">Dismiss</ToggleButton>
        <ToggleButton value="snooze">Snooze</ToggleButton>
      </ToggleButtonGroup>
      <Typography variant="caption" color="text.secondary">
        Choose what happens when you press the middle button, or tap twice, on the Pod cover
        during an alarm
      </Typography>
    </Box>
  );
}
