import { postDeviceStatus } from '@api/deviceStatus.ts';
import { useSettings } from '@api/settings.ts';
import { useTheme } from '@mui/material/styles';
import { useAppStore } from '@state/appStore';
import CircularSlider from 'react-circular-slider-svg';
import { useResizeDetector } from 'react-resize-detector';
import { useControlTempStore } from './controlTempStore.tsx';
import styles from './Slider.module.scss';
import TemperatureButtons from './TemperatureButtons.tsx';
import TemperatureLabel from './TemperatureLabel.tsx';

type SliderProps = {
  isOn: boolean;
  currentTargetTemp: number;
  currentTemperatureF: number;
  refetch: any;
  displayCelsius: boolean;
};

function getTemperatureColor(temp: number | undefined) {
  if (temp === undefined) return '#262626';
  if (temp === undefined) return '#262626';
  if (temp <= 70) return '#1c54b2';
  if (temp <= 82) return '#5393ff';
  if (temp <= 95) return '#db5858';
  return '#d32f2f';
}

export default function Slider({
  isOn,
  currentTargetTemp,
  refetch,
  currentTemperatureF,
  displayCelsius,
}: SliderProps) {
  const { deviceStatus, setDeviceStatus } = useControlTempStore();
  const { isUpdating, setIsUpdating, side, setError, clearError } =
    useAppStore();
  const { data: settings } = useSettings();
  const isInAwayMode = settings?.[side]?.awayMode;
  const disabled = isUpdating || isInAwayMode || !isOn;
  const otherSide = side === 'right' ? 'left' : 'right';
  const linkBoth = settings?.linkBothSides && !settings?.[otherSide]?.awayMode;
  const { width, ref } = useResizeDetector();
  const theme = useTheme();
  const sliderColor = getTemperatureColor(
    deviceStatus?.[side]?.targetTemperatureF,
  );
  const handleControlFinished = async () => {
    if (!deviceStatus) return;

    setIsUpdating(true);
    clearError(); // Clear any previous errors
    // If link is enabled, mirror update to the other side as well
    const payload = { ...deviceStatus } as any;
    if (linkBoth) {
      const t = deviceStatus?.[side]?.targetTemperatureF;
      if (t !== undefined) {
        payload[otherSide] = { targetTemperatureF: t };
      }
    }
    await postDeviceStatus(payload)
      .then(() => {
        // Wait 1 second before refreshing the device status
        return new Promise((resolve) => setTimeout(resolve, 1_000));
      })
      .then(() => refetch())
      .catch((error) => {
        console.error(error);

        // Extract meaningful error message for user
        let errorMessage = 'Failed to update temperature via slider';

        if (error.response?.status === 400) {
          if (error.response?.data?.details) {
            errorMessage = `Invalid temperature: ${error.response.data.details}`;
          } else {
            errorMessage =
              'Invalid temperature setting. Please check the value and try again.';
          }
        } else if (error.response?.status === 500) {
          errorMessage = 'Server error. Please try again in a moment.';
        } else if (error.code === 'NETWORK_ERROR' || !error.response) {
          errorMessage =
            'Network error. Please check your connection and try again.';
        }

        setError(errorMessage);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };

  const arcBackgroundColor = theme.palette.grey[700];

  const sideStatus = deviceStatus?.[side];
  const minTemp = Math.min(
    sideStatus?.currentTemperatureF || 55,
    sideStatus?.targetTemperatureF || 55,
  );
  const maxTemp = Math.max(
    sideStatus?.currentTemperatureF || 55,
    sideStatus?.targetTemperatureF || 55,
  );
  const isHeating =
    (sideStatus?.currentTemperatureF ?? 55) <
    (sideStatus?.targetTemperatureF ?? 55);

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-block', width: '100%' }}
    >
      {/* Circular Slider */}
      <div
        className={`${styles.Slider} ${disabled && styles.Disabled} ${isHeating && styles.Heating}`}
      >
        <CircularSlider
          disabled={disabled}
          onControlFinished={handleControlFinished}
          size={width}
          trackWidth={6}
          minValue={55}
          maxValue={110}
          startAngle={60}
          endAngle={300}
          angleType={{
            direction: 'cw',
            axis: '-y',
          }}
          handle1={{
            value: minTemp,
            onChange: (value) => {
              if (disabled) return;
              if (
                Math.round(value) !== deviceStatus?.[side]?.targetTemperatureF
              ) {
                setDeviceStatus({
                  [side]: { targetTemperatureF: Math.round(value) },
                });
              }
            },
          }}
          arcColor={isOn ? sliderColor : arcBackgroundColor}
          arcBackgroundColor={arcBackgroundColor}
          handle2={{
            value: maxTemp,
            onChange: (value) => {
              if (disabled) return;
              if (
                Math.round(value) !== deviceStatus?.[side]?.targetTemperatureF
              ) {
                setDeviceStatus({
                  [side]: { targetTemperatureF: Math.round(value) },
                });
              }
            },
          }}
          handleSize={8}
        />
      </div>
      <TemperatureLabel
        isOn={isOn}
        sliderTemp={deviceStatus?.[side]?.targetTemperatureF || 55}
        sliderColor={sliderColor}
        currentTargetTemp={currentTargetTemp}
        currentTemperatureF={currentTemperatureF}
        displayCelsius={displayCelsius}
      />
      {isOn && <TemperatureButtons refetch={refetch} />}
    </div>
  );
}
