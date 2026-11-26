import { useRef, useCallback } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import { Button, Box } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { useControlTempStore } from './controlTempStore.tsx';
import { useAppStore } from '@state/appStore.tsx';
import { postDeviceStatus } from '@api/deviceStatus.ts';
import { useSettings } from '@api/settings.ts';
import { MIN_TEMP_F, MAX_TEMP_F } from '@lib/temperatureConversions.ts';

type TemperatureButtonsProps = {
  refetch: any;
  currentTargetTemp: number;
}

const DEBOUNCE_MS = 2000;
export default function TemperatureButtons({ refetch, currentTargetTemp }: TemperatureButtonsProps) {
  const { side, setIsUpdating, isUpdating } = useAppStore();
  const { deviceStatus, setDeviceStatus } = useControlTempStore();
  const { data: settings } = useSettings();
  const theme = useTheme();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const postUpdate = useCallback(async () => {
    setIsUpdating(true);
    try {
      await postDeviceStatus({
        [side]: { targetTemperatureF: deviceStatus?.[side]?.targetTemperatureF },
      });
      await new Promise(r => setTimeout(r, 1_500));
      await refetch?.();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  }, [deviceStatus, side, refetch, setIsUpdating]);

  const scheduleUpdate = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(postUpdate, DEBOUNCE_MS);
  }, [postUpdate]);


  const isInAwayMode = settings?.[side]?.awayMode;
  if (isInAwayMode) return null;

  const disabled = isUpdating || isInAwayMode;
  const iconColor = theme.palette.text.primary;

  const handleClick = (change: number) => {
    if (!deviceStatus) return;
    if (deviceStatus === undefined) return;
    setDeviceStatus({
      [side]: {
        targetTemperatureF: deviceStatus[side].targetTemperatureF + change,
      }
    });

    scheduleUpdate();
  };

  const buttonStyle = {
    width: 56,
    height: 56,
    minWidth: 0,
    padding: 0,
    borderRadius: '50%',
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.06 : 0.04),
    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.14), borderColor: alpha(theme.palette.primary.main, 0.4) },
  };

  return (
    <Box
      sx={ {
        top: '76%',
        position: 'absolute',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '96px',
        width: '100%',
        marginLeft: 'auto',
        marginRight: 'auto',
      } }
    >
      <Button
        variant="outlined"
        color="primary"
        aria-label="Decrease temperature"
        sx={ buttonStyle }
        onClick={ () => handleClick(-1) }
        disabled={ disabled || currentTargetTemp <= MIN_TEMP_F }
      >
        <RemoveRoundedIcon sx={ { color: iconColor, fontSize: 26 } }/>
      </Button>
      <Button
        variant="outlined"
        aria-label="Increase temperature"
        sx={ buttonStyle }

        onClick={ () => handleClick(1) }
        disabled={ disabled || currentTargetTemp >= MAX_TEMP_F }
      >
        <AddRoundedIcon sx={ { color: iconColor, fontSize: 26 } }/>
      </Button>
    </Box>
  );
}
