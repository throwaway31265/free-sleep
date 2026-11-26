import { Box, ToggleButtonGroup, ToggleButton, Typography } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { useSettings } from '@api/settings.ts';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { formatTemperature, getTemperatureColor } from '@lib/temperatureConversions.ts';

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
      sx={ { width: '100%', '& .MuiToggleButton-root': { flex: 1, minWidth: 0, minHeight: 46 } } }
    >
      { (['left', 'right'] as const).map(bedSide => {
        const sideStatus = deviceStatus?.[bedSide];
        const isOn = Boolean(sideStatus?.isOn);
        return (
          <ToggleButton key={ bedSide } value={ bedSide } aria-label={ `${bedSide} side` }>
            <Box component="span" sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, minWidth: 0 } }>
              { showTemp && (
                <Box
                  component="span"
                  aria-hidden
                  sx={ theme => ({
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    bgcolor: isOn ? getTemperatureColor(sideStatus?.targetTemperatureF) : theme.palette.text.disabled,
                  }) }
                />
              ) }
              <Typography component="span" variant="body2" noWrap sx={ { fontWeight: 600 } }>
                { settings?.[bedSide]?.name || `${bedSide === 'left' ? 'Left' : 'Right'} side` }
              </Typography>
              { showTemp && side !== bedSide && (
                <Typography component="span" variant="caption" sx={ { color: 'text.secondary', flexShrink: 0 } }>
                  { isOn && sideStatus ? formatTemperature(sideStatus.targetTemperatureF, isCelsius) : 'Off' }
                </Typography>
              ) }
            </Box>
          </ToggleButton>
        );
      }) }
    </ToggleButtonGroup>
  );
}
