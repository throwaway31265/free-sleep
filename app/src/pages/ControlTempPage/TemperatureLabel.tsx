import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import moment from 'moment-timezone';
import { useSchedules } from '@api/schedules.ts';
import { useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import { DayOfWeek } from '@api/schedulesSchema.ts';
import { formatTemperature } from '@lib/temperatureConversions.ts';

type TemperatureLabelProps = {
  isOn: boolean;
  sliderTemp: number;
  sliderColor: string;
  currentTargetTemp: number;
  currentTemperatureF: number;
  displayCelsius: boolean;
};

export default function TemperatureLabel({
  isOn, sliderTemp, sliderColor, currentTargetTemp, currentTemperatureF, displayCelsius,
}: TemperatureLabelProps) {
  const { side } = useAppStore();
  const { data: schedules } = useSchedules();
  const { data: settings } = useSettings();
  const currentDay = settings?.timeZone && moment.tz(settings.timeZone).format('dddd').toLowerCase() as DayOfWeek;
  const power = currentDay ? schedules?.[side]?.[currentDay]?.power : undefined;
  const temperature = formatTemperature(sliderTemp, displayCelsius);
  const isAdjusting = sliderTemp !== currentTargetTemp;
  let targetLabel = 'Holding';
  if (sliderTemp < currentTemperatureF) targetLabel = isAdjusting ? 'Cool to' : 'Cooling to';
  if (sliderTemp > currentTemperatureF) targetLabel = isAdjusting ? 'Warm to' : 'Warming to';

  return (
    <Box sx={ { textAlign: 'center', whiteSpace: 'nowrap', pointerEvents: 'none', mt: -2 } }>
      <Typography
        variant="overline"
        sx={ { color: isOn ? sliderColor : 'text.secondary', minHeight: 22, display: 'block', fontSize: 11 } }
      >
        { isOn ? targetLabel : 'Standby' }
      </Typography>
      <Typography
        component="p"
        sx={ {
          fontSize: isOn ? 'clamp(56px, 17vw, 76px)' : 'clamp(44px, 13vw, 56px)',
          fontWeight: 300, letterSpacing: '-0.05em', lineHeight: 1, my: 0.75,
          fontVariantNumeric: 'tabular-nums',
          color: isOn ? 'text.primary' : 'text.secondary',
        } }
      >
        { isOn ? (
          <>
            { temperature.split('°')[0] }
            <Box
              component="span"
              sx={ { fontSize: '0.38em', fontWeight: 400, verticalAlign: 'top', lineHeight: 1.6, ml: 0.25, color: 'text.secondary' } }
            >
              °{ displayCelsius ? 'C' : 'F' }
            </Box>
          </>
        ) : 'Off' }
      </Typography>
      { isOn && (
        <Box
          sx={ theme => ({
            display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.4, borderRadius: 999,
            bgcolor: alpha(theme.palette.text.primary, 0.05),
          }) }
        >
          <Box component="span" sx={ { width: 6, height: 6, borderRadius: '50%', bgcolor: sliderColor } }/>
          <Typography variant="caption" sx={ { color: 'text.secondary', fontWeight: 500 } }>
            Now { formatTemperature(currentTemperatureF, displayCelsius) }
          </Typography>
        </Box>
      ) }
      { power?.enabled && (isOn || !settings?.[side]?.awayMode) && (
        <Typography variant="caption" sx={ { color: 'text.secondary', display: 'block', mt: 1 } }>
          { isOn ? 'Turns off at' : 'Turns on at' } { moment(isOn ? power.off : power.on, 'HH:mm').format('h:mm A') }
        </Typography>
      ) }
    </Box>
  );
}
