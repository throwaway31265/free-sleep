import { postSettings, useSettings } from '@api/settings.ts';
import type { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import type { DeepPartial } from 'ts-essentials';
import PageContainer from '../PageContainer.tsx';
import DailyPriming from './DailyPriming.tsx';
import DailyReboot from './DailyReboot.tsx';
import DiscordLink from './DiscordLink.tsx';
import Divider from './Divider.tsx';
import Donate from './Donate.tsx';
import LedBrightnessSlider from './LedBrightnessSlider.tsx';
import LicenseModal from './LicenseModal.tsx';
import PrimeControl from './PrimeControl.tsx';
import SideSettings from './SideSettings.tsx';
import TemperatureFormatSelector from './TemperatureFormatSelector.tsx';
import TimeZoneSelector from './TimeZoneSelector.tsx';

export default function SettingsPage() {
  const { data: settings, refetch } = useSettings();
  const { setIsUpdating } = useAppStore();

  const updateSettings = (settings: DeepPartial<Settings>) => {
    // console.log(`SettingsPage.tsx:21 | settings: `, settings);
    // return
    setIsUpdating(true);

    postSettings(settings)
      .then(() => {
        // Wait 1 second before refreshing the device status
        return new Promise((resolve) => setTimeout(resolve, 1_000));
      })
      .then(() => refetch())
      .catch((error) => {
        console.error(error);
      })
      .finally(() => setIsUpdating(false));
  };

  return (
    <PageContainer sx={{ mb: 15, mt: 2 }}>
      <TimeZoneSelector settings={settings} updateSettings={updateSettings} />
      <TemperatureFormatSelector
        settings={settings}
        updateSettings={updateSettings}
      />
      <DailyReboot settings={settings} updateSettings={updateSettings} />
      <Divider />
      <DailyPriming settings={settings} updateSettings={updateSettings} />
      <PrimeControl />

      <Divider />
      <SideSettings
        side="left"
        settings={settings}
        updateSettings={updateSettings}
      />
      <br />
      <SideSettings
        side="right"
        settings={settings}
        updateSettings={updateSettings}
      />
      <Divider />
      <LedBrightnessSlider />

      <Divider />
      <DiscordLink />
      <Divider />
      <Donate />
      <Divider />
      <LicenseModal />
    </PageContainer>
  );
}
