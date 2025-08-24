import type { Settings } from '@api/settingsSchema.ts';
import Alert from '@mui/material/Alert';
import { useAppStore } from '@state/appStore.tsx';

type AwayNotificationProps = {
  settings?: Settings;
};

export default function AwayNotification({ settings }: AwayNotificationProps) {
  const { side } = useAppStore();

  const otherSide = side === 'right' ? 'left' : 'right';

  if (settings?.[side]?.awayMode && settings?.[otherSide]?.awayMode) {
    return (
      <Alert severity="info">
        Both sides are in away mode. Temperature control is disabled.
      </Alert>
    );
  }
  if (settings?.[otherSide]?.awayMode) {
    return (
      <Alert severity="info">
        Other side is in away mode. Their side is off.
      </Alert>
    );
  }
  if (settings?.[side]?.awayMode) {
    return (
      <Alert severity="info" sx={{ transform: 'translateY(-100px)' }}>
        This side is in away mode, temperature control unavailable
      </Alert>
    );
  }
  return null;
}
