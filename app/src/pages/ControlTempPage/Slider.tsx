import { useEffect, useState } from 'react';
import CircularSlider from 'react-circular-slider-svg';
import { DeepPartial } from 'ts-essentials';
import { DeviceStatus } from '@api/deviceStatusSchema.ts';
import { postDeviceStatus } from '@api/deviceStatus.ts';
import { useAppStore } from '@state/appStore';
import styles from './Slider.module.scss';
import TemperatureLabel from './TemperatureLabel.tsx';


type SliderProps = {
  isOn: boolean;
  currentTargetTemp: number;
  currentTemperatureF: number;
  refetch: any;
  displayCelsius: boolean;
}

function getTemperatureColor(temp: number) {
  if (temp <= 70) return '#1c54b2';
  if (temp <= 82) return '#5393ff';
  if (temp <= 95) return '#db5858';
  return '#d32f2f';
}

export default function Slider({ isOn, currentTargetTemp, refetch, currentTemperatureF, displayCelsius }: SliderProps) {
  const { isUpdating, setIsUpdating, side } = useAppStore();
  const [sliderTemp, setSliderTemp] = useState(55);
  const sliderColor = getTemperatureColor(sliderTemp);
  const [isPostingTempChange, setIsPostingTempChange] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  // Sync sliderTemp with currentTargetTemp when the API response updates
  useEffect(() => {
    if (!isUserInteracting && !isPostingTempChange) {
      setSliderTemp(currentTargetTemp);
    }
  }, [currentTargetTemp, isUserInteracting]);

  const handleControlFinished = async () => {
    setIsPostingTempChange(true);
    setIsUserInteracting(false);
    const deviceStatus: DeepPartial<DeviceStatus> = {
      [side]: { targetTemperatureF: sliderTemp },
    };
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
        setIsPostingTempChange(false);
      });
  };

  const disabled = !isOn || isUpdating;
  const arcBackgroundColor = '#2E2E2EFF';


  let val: number;
  if (isPostingTempChange || isUserInteracting) {
    val = sliderTemp
  } else {
    val = (isOn) ? sliderTemp || currentTargetTemp : 55
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: 400, height: 250 }}>
      {/* Circular Slider */}
      <div className={`${styles.Slider} ${disabled && styles.Disabled}`}>
        <CircularSlider
          disabled={disabled}
          onControlFinished={handleControlFinished}
          size={400}
          trackWidth={40}
          minValue={55}
          maxValue={110}
          startAngle={90}
          endAngle={270}
          angleType={{
            direction: 'cw',
            axis: '-y'
          }}
          handle1={{
            value: val,
            onChange: (value) => {
              if (disabled) return;
              if (Math.round(value) !== sliderTemp) {
                setSliderTemp(Math.round(value))
                setIsUserInteracting(true);
              }
            },

          }}
          arcColor={isOn ? sliderColor : arcBackgroundColor}
          arcBackgroundColor={arcBackgroundColor}
        />
      </div>

      {/* Overlay Text */}
      {
        isOn && (
          <TemperatureLabel
            sliderTemp={sliderTemp}
            sliderColor={sliderColor}
            currentTargetTemp={currentTargetTemp}
            currentTemperatureF={currentTemperatureF}
            displayCelsius={displayCelsius}
          />
        )}
    </div>

  );
};
