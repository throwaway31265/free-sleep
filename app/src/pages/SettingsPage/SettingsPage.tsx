import { DeepPartial } from 'ts-essentials';

import SideSettings from './SideSettings.tsx';
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
import Donate from './Donate.tsx';
import DiscordLink from './DiscordLink.tsx';
import Divider from './Divider.tsx';


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
      .catch(error => {
        console.error(error);
      })
      .finally(() => setIsUpdating(false));
  };

  return (
    <PageContainer sx={ { mb: 15, mt: 2 } }>
      <TimeZoneSelector settings={ settings } updateSettings={ updateSettings }/>
      <TemperatureFormatSelector settings={ settings } updateSettings={ updateSettings } />

      <Divider />
      <DailyPriming settings={ settings } updateSettings={ updateSettings }/>
      <PrimeControl/>

      <Divider />
      <SideSettings side="left" settings={ settings } updateSettings={ updateSettings }/>
      <br />
      <SideSettings side="right" settings={ settings } updateSettings={ updateSettings }/>
      <Divider />
      <LedBrightnessSlider/>

      <Divider />
      <DiscordLink />
      <Divider />
      <Donate />
      <Divider />
      <LicenseModal/>
    </PageContainer>
  );
}
