import Typography from '@mui/material/Typography';
import styles from './TemperatureLabel.module.scss';
import { useTheme } from '@mui/material/styles';
import { useSchedules } from '@api/schedules.ts';
import moment from 'moment-timezone';
import { useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';


type TemperatureLabelProps = {
  isOn: boolean;
  sliderTemp: number;
  sliderColor: string;
  currentTargetTemp: number;
  currentTemperatureF: number;
  displayCelsius: boolean;
}

function farenheitToCelcius(farenheit: number) {
  return (farenheit - 32) * 5 / 9;
}

function roundToNearestHalf(number: number) {
  return Math.round(number * 2) / 2;
}

export function formatTemperature(temperature: number, celcius: boolean) {
  return celcius ? `${roundToNearestHalf(farenheitToCelcius(temperature))}°C` : `${temperature}°F`;
}

export default function TemperatureLabel({
  isOn,
  sliderTemp,
  sliderColor,
  currentTargetTemp,
  currentTemperatureF,
  displayCelsius
}: TemperatureLabelProps) {


  const theme = useTheme();
  const { side } = useAppStore();
  const { data: schedules } = useSchedules();
  const { data: settings } = useSettings();
  const currentDay = settings?.timeZone && moment.tz(settings?.timeZone).format('dddd').toLowerCase();
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
      style={ {
        position: 'absolute',
        top: '10%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        textAlign: 'center',
        height: '300px',
        width: '100%',
      } }
    >
      {
        isOn ? (
          <>
            <Typography
              style={ { top: '70%', } }
              className={ styles.label }
              color={ theme.palette.grey[400] }
            >
              { topTitle }
            </Typography>

            { /* Temperature */ }
            <Typography
              style={ { top: '80%' } }
              variant="h2"
              color={ sliderColor }
              className={ styles.label }
            >
              { formatTemperature(currentTargetTemp !== sliderTemp ? sliderTemp : currentTargetTemp, displayCelsius) }
            </Typography>

            { /* Currently at label */ }
            <Typography
              style={ { top: '105%' } }
              className={ styles.label }
              color={ theme.palette.grey[400] }
            >
              { `Currently at ${formatTemperature(currentTemperatureF, displayCelsius)}` }
            </Typography>
          </>
        ) : (
          <>
            <Typography
              style={ { top: '80%' } }
              variant="h3"
              color={ theme.palette.grey[800] }
              className={ styles.label }
            >
              Off
            </Typography>
            {
              power?.enabled && (
                <Typography
                  style={ { top: '105%' } }
                  // variant="h3"
                  color={ theme.palette.grey[800] }
                  className={ styles.label }
                >

                  Turns on at { formattedTime }
                </Typography>
              )
            }
          </>
        )
      }
    </div>
  );
}
