import { useSchedules } from '@api/schedules.ts';
import { useSettings } from '@api/settings.ts';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useAppStore } from '@state/appStore.tsx';
import moment from 'moment-timezone';
import styles from './TemperatureLabel.module.scss';

type TemperatureLabelProps = {
  isOn: boolean;
  sliderTemp: number;
  sliderColor: string;
  currentTargetTemp: number;
  currentTemperatureF: number;
  displayCelsius: boolean;
};

function farenheitToCelcius(farenheit: number) {
  return ((farenheit - 32) * 5) / 9;
}

function roundToNearestHalf(number: number) {
  return Math.round(number * 2) / 2;
}

function temperatureToScale(temperatureF: number): number {
  // Based on the formula T(x) = 2.75x + 82.5
  // Solving for x: x = (T - 82.5) / 2.75
  return Math.round((temperatureF - 82.5) / 2.75);
}

export function formatTemperature(temperature: number, celcius: boolean) {
  return celcius
    ? `${roundToNearestHalf(farenheitToCelcius(temperature))}°C`
    : `${temperature}°F`;
}

export default function TemperatureLabel({
  isOn,
  sliderTemp,
  sliderColor,
  currentTargetTemp,
  currentTemperatureF,
  displayCelsius,
}: TemperatureLabelProps) {
  const theme = useTheme();
  const { side } = useAppStore();
  const { data: schedules } = useSchedules();
  const { data: settings } = useSettings();
  const isInAwayMode = settings?.[side]?.awayMode;

  const currentDay =
    settings?.timeZone &&
    moment.tz(settings?.timeZone).format('dddd').toLowerCase();
  // @ts-ignore
  const power = currentDay ? schedules?.[side]?.[currentDay]?.power : undefined;
  const formattedTime = moment(power?.on, 'HH:mm').format('h:mm A');

  let topTitle: string;
  // Handle user actively changing temp
  if (sliderTemp !== currentTargetTemp) {
    if (sliderTemp < currentTemperatureF) {
      topTitle = 'Cool to';
    } else if (sliderTemp > currentTemperatureF) {
      topTitle = 'Warm to';
    } else {
      topTitle = '';
    }
  } else {
    if (currentTemperatureF < currentTargetTemp) {
      topTitle = 'Warming to';
    } else if (currentTemperatureF > currentTargetTemp) {
      topTitle = 'Cooling to';
    } else {
      topTitle = '';
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '10%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        textAlign: 'center',
        height: '300px',
        width: '100%',
      }}
    >
      {isOn ? (
        <>
          <Typography
            style={{ top: '70%' }}
            className={styles.label}
            color={theme.palette.grey[400]}
          >
            {topTitle}
          </Typography>

          {/* Temperature */}
          <Typography
            style={{ top: '80%' }}
            variant="h2"
            color={sliderColor}
            className={styles.label}
          >
            {formatTemperature(
              currentTargetTemp !== sliderTemp ? sliderTemp : currentTargetTemp,
              displayCelsius,
            )}
          </Typography>

          {/* Scale (-10 to +10) */}
          <Typography
            style={{ top: '100%' }}
            className={styles.label}
            color={theme.palette.grey[500]}
            variant="body2"
          >
            Scale: {temperatureToScale(currentTargetTemp !== sliderTemp ? sliderTemp : currentTargetTemp)}
          </Typography>

          {/* Currently at label */}
          <Typography
            style={{ top: '115%' }}
            className={styles.label}
            color={theme.palette.grey[400]}
          >
            {`Currently at ${formatTemperature(currentTemperatureF, displayCelsius)} (${temperatureToScale(currentTemperatureF)})`}
          </Typography>
        </>
      ) : (
        <>
          <Typography
            style={{ top: '80%' }}
            variant="h3"
            color={theme.palette.grey[800]}
            className={styles.label}
          >
            Off
          </Typography>
          {power?.enabled && !isInAwayMode && (
            <Typography
              style={{ top: '105%' }}
              // variant="h3"
              color={theme.palette.grey[800]}
              className={styles.label}
            >
              Turns on at {formattedTime}
            </Typography>
          )}
        </>
      )}
    </div>
  );
}
