import CircularSlider from 'react-circular-slider-svg';
import { postDeviceStatus } from '@api/deviceStatus.ts';
import { useAppStore } from '@state/appStore';
import styles from './Slider.module.scss';
import TemperatureLabel from './TemperatureLabel.tsx';
import TemperatureButtons from './TemperatureButtons.tsx';
import { useControlTempStore } from './controlTempStore.tsx';
import { useTheme } from '@mui/material/styles';
import { useResizeDetector } from 'react-resize-detector';

type SliderProps = {
  isOn: boolean;
  currentTargetTemp: number;
  currentTemperatureF: number;
  refetch: any;
  displayCelsius: boolean;
}

function getTemperatureColor(temp: number | undefined) {
  if (temp === undefined) return '#262626';
  if (temp <= 70) return '#1c54b2';
  if (temp <= 82) return '#5393ff';
  if (temp <= 95) return '#db5858';
  return '#d32f2f';
}

export default function Slider({ isOn, currentTargetTemp, refetch, currentTemperatureF, displayCelsius }: SliderProps) {
  const { deviceStatus, setDeviceStatus } = useControlTempStore();
  const { isUpdating, setIsUpdating, side } = useAppStore();
  const { width, ref } = useResizeDetector();
  const theme = useTheme();
  const sliderColor = getTemperatureColor(deviceStatus?.[side].targetTemperatureF);

  const handleControlFinished = async () => {
    if (!deviceStatus) return;

    setIsUpdating(true);
    await postDeviceStatus(deviceStatus)
      .then(() => {
        // Wait 1 second before refreshing the device status
        return new Promise((resolve) => setTimeout(resolve, 1_000));
      })
      .then(() => refetch())
      .catch(error => {
        console.error(error);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };

  const disabled = !isOn || isUpdating;
  const arcBackgroundColor = theme.palette.grey[800];

  return (
    <div ref={ ref } style={ { position: 'relative', display: 'inline-block', width: '100%' } }>
      { /* Circular Slider */ }
      <div className={ `${styles.Slider} ${disabled && styles.Disabled}` }>
        <CircularSlider
          disabled={ disabled }
          onControlFinished={ handleControlFinished }
          size={ width }
          trackWidth={ 30 }
          minValue={ 55 }
          maxValue={ 110 }
          startAngle={ 60 }
          endAngle={ 300 }
          angleType={ {
            direction: 'cw',
            axis: '-y'
          } }
          handle1={ {
            value: deviceStatus?.[side]?.targetTemperatureF || 55,
            onChange: (value) => {
              if (disabled) return;
              if (Math.round(value) !== deviceStatus?.[side]?.targetTemperatureF) {
                setDeviceStatus({ [side]: { targetTemperatureF: Math.round(value) } });
              }
            },

          } }
          arcColor={ isOn ? sliderColor : arcBackgroundColor }
          arcBackgroundColor={ arcBackgroundColor }
        />
      </div>
      <TemperatureLabel
        isOn={ isOn }
        sliderTemp={ deviceStatus?.[side]?.targetTemperatureF || 55 }
        sliderColor={ sliderColor }
        currentTargetTemp={ currentTargetTemp }
        currentTemperatureF={ currentTemperatureF }
        displayCelsius={ displayCelsius }
      />
      {
        isOn && (
          <TemperatureButtons refetch={ refetch }/>
        ) }
    </div>
  );
};
