import { DeepPartial } from 'ts-essentials';
import { Box, Divider } from '@mui/material';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { Settings } from '@api/settingsSchema.ts';
import Section from '../Section.tsx';
import TimeZoneSelector from './TimeZoneSelector.tsx';
import TemperatureFormatSelector from './TemperatureFormatSelector.tsx';
import LedBrightnessSlider from './LedBrightnessSlider.tsx';
import { useSettings } from '@api/settings.ts';

type UpdateSettingsFn = (settings: DeepPartial<Settings>) => void;
type DeviceSettingsSectionProps = { updateSettings: UpdateSettingsFn };

export default function DeviceSettingsSection({ updateSettings }: DeviceSettingsSectionProps) {
  const { data: settings } = useSettings();

  return (
    <Section title="Device settings" icon={ <TuneOutlinedIcon/> }>
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2.5 } }>
        <TimeZoneSelector settings={ settings } updateSettings={ updateSettings }/>
        <TemperatureFormatSelector settings={ settings } updateSettings={ updateSettings }/>
        <Divider/>
        <LedBrightnessSlider/>
      </Box>
    </Section>
  );
}
