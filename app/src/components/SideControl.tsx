import { Box, ToggleButtonGroup, ToggleButton, Typography } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { useSettings } from '@api/settings.ts';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { formatTemperature } from '@lib/temperatureConversions.ts';

type SideControlProps = { showTemp?: boolean };

export default function SideControl({ showTemp }: SideControlProps) {
  const { side, setSide } = useAppStore();
  const { data: settings } = useSettings();
  const { data: deviceStatus } = useDeviceStatus();
  const isCelsius = settings?.temperatureFormat === 'celsius';

  return (
    <ToggleButtonGroup
      exclusive
      value={ side }
      onChange={ (_, selectedSide: unknown) => {
        if (selectedSide === 'left' || selectedSide === 'right') setSide(selectedSide);
      } }
      size="small"
      aria-label="Bed side"
      sx={ { width: '100%', '& .MuiToggleButton-root': { flex: 1, minWidth: 0 } } }
    >
      { (['left', 'right'] as const).map(bedSide => (
        <ToggleButton key={ bedSide } value={ bedSide } aria-label={ `${bedSide} side` }>
          <Box component="span" sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, minWidth: 0 } }>
            <Typography component="span" variant="body2" sx={ { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }>
              { settings?.[bedSide]?.name || `${bedSide === 'left' ? 'Left' : 'Right'} side` }
            </Typography>
            { showTemp && side !== bedSide && (
              <Typography component="span" variant="caption" color="text.secondary" sx={ { flexShrink: 0 } }>
                { deviceStatus?.[bedSide]?.isOn ? formatTemperature(deviceStatus[bedSide].targetTemperatureF, isCelsius) : 'Off' }
              </Typography>
            ) }
          </Box>
        </ToggleButton>
      )) }
    </ToggleButtonGroup>
  );
}
