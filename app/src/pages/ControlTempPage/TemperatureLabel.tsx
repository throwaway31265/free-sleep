import { Box, Typography } from '@mui/material';
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
  let targetLabel = '';
  if (sliderTemp < currentTemperatureF) targetLabel = isAdjusting ? 'Cool to' : 'Cooling to';
  if (sliderTemp > currentTemperatureF) targetLabel = isAdjusting ? 'Warm to' : 'Warming to';

  return (
    <Box sx={ { textAlign: 'center', whiteSpace: 'nowrap', pointerEvents: 'none' } }>
      <Typography variant="body2" sx={ { color: 'text.secondary', minHeight: 21 } }>{ isOn ? targetLabel : '' }</Typography>
      <Typography
        component="p"
        sx={ {
          fontSize: isOn ? 'clamp(44px, 14vw, 64px)' : 'clamp(40px, 12vw, 52px)',
          fontWeight: 500, letterSpacing: '-0.065em', lineHeight: 1.2, my: 0.5,
        } }
      >
        { isOn ? (
          <>
            { temperature.split('°')[0] }
            <Box component="span" sx={ { fontSize: 27, verticalAlign: 'top', lineHeight: 2 } }>
              °{ displayCelsius ? 'C' : 'F' }
            </Box>
          </>
        ) : 'Off' }
      </Typography>
      { isOn && (
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 } }>
          <Box component="span" sx={ { width: 5, height: 5, borderRadius: '50%', bgcolor: sliderColor } }/>
          <Typography variant="caption" sx={ { color: 'text.secondary' } }>
            Currently at { formatTemperature(currentTemperatureF, displayCelsius) }
          </Typography>
        </Box>
      ) }
      { power?.enabled && (isOn || !settings?.[side]?.awayMode) && (
        <Typography variant="caption" sx={ { color: 'text.secondary', display: 'block', mt: 0.75 } }>
          { isOn ? 'Turns off at' : 'Turns on at' } { moment(isOn ? power.off : power.on, 'HH:mm').format('h:mm A') }
        </Typography>
      ) }
    </Box>
  );
}
