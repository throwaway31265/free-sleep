import Alert from '@mui/material/Alert';
import { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';

type AwayNotificationProps = {
  settings?: Settings;
}

export default function AwayNotification({ settings }: AwayNotificationProps) {
  const { side } = useAppStore();

  const otherSide = side === 'right' ? 'left' : 'right';

  if (settings?.[side]?.awayMode && settings?.[otherSide]?.awayMode) {
    return (
      <Alert severity="info">
        Both sides are in away mode, temperature settings will apply to both sides
      </Alert>
    );
  }
  if (settings?.[otherSide]?.awayMode) {
    return (
      <Alert severity="info">
        Other side is in away mode, temperature settings will apply to both sides
      </Alert>
    );
  }
  if (settings?.[side]?.awayMode) {
    return (
      <Alert severity="info">
        This side is in away mode
      </Alert>
    );
  }
  return null;
}
