import { DeepPartial } from 'ts-essentials';

import AwayModeSwitch from './AwayModeSwitch.tsx';
import PageContainer from '../PageContainer.tsx';
import TimeZoneSelector from './TimeZoneSelector.tsx';
import TemperatureFormatSelector from './TemperatureFormatSelector.tsx';
import { Settings } from '@api/settingsSchema.ts';
import { postSettings, useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import DailyPriming from './DailyPriming.tsx';
import LicenseModal from './LicenseModal.tsx';
import PrimeControl from './PrimeControl.tsx';
import LedBrightnessSlider from './LedBrightnessSlider.tsx';


export default function SettingsPage() {
  const { data: settings, refetch } = useSettings();
  const { setIsUpdating } = useAppStore();

  const updateSettings = (settings: DeepPartial<Settings>) => {
    setIsUpdating(true);

    postSettings(settings)
      .then(() => {
        // Wait 1 second before refreshing the device status
        return new Promise((resolve) => setTimeout(resolve, 1_000));
      })
      .then(() => refetch())
      .catch(error => {
        console.error(error);
      })
      .finally(() => setIsUpdating(false));
  };

  return (
    <PageContainer sx={{ mb: 10 }}>
      <TimeZoneSelector settings={settings} updateSettings={updateSettings}/>
      <TemperatureFormatSelector settings={settings} updateSettings={updateSettings} />
      <br />
      <DailyPriming settings={settings} updateSettings={updateSettings}/>
      <PrimeControl/>
      <br />
      <AwayModeSwitch side="left" settings={settings} updateSettings={updateSettings}/>
      <AwayModeSwitch side="right" settings={settings} updateSettings={updateSettings}/>
      <br />
      <LedBrightnessSlider/>
      <br />
      <LicenseModal/>
    </PageContainer>
  );
}
