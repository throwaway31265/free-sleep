import {
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { useSettings } from '@api/settings.ts';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { formatTemperature } from '@lib/temperatureConversions.ts';

type SideControlProps = {
  showTemp?: boolean;
};

export default function SideControl({ showTemp }: SideControlProps) {
  const { side, setSide } = useAppStore();
  const { data: settings } = useSettings();
  const { data: deviceStatus } = useDeviceStatus();

  const isCelsius = settings?.temperatureFormat === 'celsius';
  return (
    <ToggleButtonGroup
      color="primary"
      exclusive
      value={ side }
      onChange={ (event) => {
        setSide(event.target.value);
      } }
      size="small"
    >
      <ToggleButton value="left" sx={ { p: 1 } }>
        { settings?.left?.name } &nbsp;
        { showTemp && side === 'right' && (

          deviceStatus?.left?.isOn ?

            formatTemperature(deviceStatus?.left?.targetTemperatureF, isCelsius)
            : 'Off'
        ) }
      </ToggleButton>
      <ToggleButton value="right">
        { settings?.right?.name } &nbsp;
        { showTemp && side === 'left' && (

          deviceStatus?.right?.isOn ?
            formatTemperature(deviceStatus?.right?.targetTemperatureF, isCelsius) : 'Off'

        ) }

      </ToggleButton>
    </ToggleButtonGroup>

  );
}
