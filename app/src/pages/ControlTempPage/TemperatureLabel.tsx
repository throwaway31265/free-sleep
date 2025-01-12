import Typography from '@mui/material/Typography';
import styles from './TemperatureLabel.module.scss';

type TemperatureLabelProps = {
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
                                           sliderTemp,
                                           sliderColor,
                                           currentTargetTemp,
                                           currentTemperatureF,
                                           displayCelsius
                                         }: TemperatureLabelProps) {
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
        top: '35%', // Center vertically
        left: '50%', // Center horizontally
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        textAlign: 'center',
        height: '200px',
        width: '100%',
      }}
    >
      {/* Top Title */}
      <Typography
        style={{ top: '70%', }}
        className={styles.label}
      >
        {topTitle}
      </Typography>

      {/* Temperature */}
      <Typography
        style={{ top: '80%' }}
        variant="h3"
        color={sliderColor}
        className={styles.label}
      >
        {formatTemperature(currentTargetTemp !== sliderTemp ? sliderTemp : currentTargetTemp, displayCelsius)}
      </Typography>

      {/* Currently at label */}
      <Typography
        style={{ top: '105%' }}
        className={styles.label}
      >
        {`Currently at ${formatTemperature(currentTemperatureF, displayCelsius)}`}
      </Typography>
    </div>
  );
}
