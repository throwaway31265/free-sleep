import { postSettings, useSettings } from '@api/settings.ts';
import { useBaseStatus } from '@api/baseControl';
import type { Settings } from '@api/settingsSchema.ts';
import DailyPriming from '@components/settings/DailyPriming.tsx';
import DailyReboot from '@components/settings/DailyReboot.tsx';
import DiscordLink from '@components/settings/DiscordLink.tsx';
import Divider from '@components/settings/Divider.tsx';
import Donate from '@components/settings/Donate.tsx';
import LedBrightnessSlider from '@components/settings/LedBrightnessSlider.tsx';
import LicenseModal from '@components/settings/LicenseModal.tsx';
import PrimeControl from '@components/settings/PrimeControl.tsx';
import SideSettings from '@components/settings/SideSettings.tsx';
import TemperatureFormatSelector from '@components/settings/TemperatureFormatSelector.tsx';
import TimeZoneSelector from '@components/settings/TimeZoneSelector.tsx';
import VersionInfo from '@components/settings/VersionInfo.tsx';
import { useAppStore } from '@state/appStore.tsx';
import { createFileRoute } from '@tanstack/react-router';
import type { DeepPartial } from 'ts-essentials';
import PageContainer from '@/components/shared/PageContainer.tsx';
import SectionCard from '@/components/shared/SectionCard.tsx';
import Box from '@mui/material/Box';


function SettingsPage() {
  const { data: settings, refetch } = useSettings();
  const { setIsUpdating } = useAppStore();
  const { data: baseStatus } = useBaseStatus();

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

  if (!settings) {
    return null; // Will be caught by error boundary if data fails to load
  }

  return (
    <PageContainer sx={{ mb: 15, mt: 2 }}>
      {baseStatus?.isConfigured === false && (
        <div role="alert" style={{
          padding: '12px 16px',
          borderRadius: 8,
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          marginBottom: 16,
          color: '#fff',
        }}>
          Elevation controls are disabled because no compatible elevation base was detected on your 8 Sleep. If you add one later, restart the server and the Elevation page will appear.
        </div>
      )}

      <Box
        sx={{
          width: '100%',
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          alignItems: 'start',
        }}
      >
        <SectionCard
          title="Display & Regional"
          subheader="Configure display preferences and regional settings"
        >
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TimeZoneSelector settings={settings} updateSettings={updateSettings} />
            <TemperatureFormatSelector
              settings={settings}
              updateSettings={updateSettings}
            />
          </Box>
          <LedBrightnessSlider />
        </SectionCard>

        <SectionCard
          title="Bed Configuration"
          subheader="Customize names and control settings for each side"
        >
          <SideSettings
            side="left"
            settings={settings}
            updateSettings={updateSettings}
          />
          <Divider />
          <SideSettings
            side="right"
            settings={settings}
            updateSettings={updateSettings}
          />
        </SectionCard>

        <SectionCard
          title="System & Maintenance"
          subheader="System health and maintenance automation"
        >
          <DailyReboot settings={settings} updateSettings={updateSettings} />
          <DailyPriming settings={settings} updateSettings={updateSettings} />
          <PrimeControl />
        </SectionCard>

        <SectionCard
          title="System Information"
          subheader="Version details and update status"
        >
          <VersionInfo />
        </SectionCard>

        <SectionCard
          title="Community & Support"
          subheader="Get help and connect with other users"
        >
          <DiscordLink />
        </SectionCard>

        <SectionCard
          title="Support Development"
          subheader="Help fund continued development"
        >
          <Donate />
        </SectionCard>

        <SectionCard
          title="Legal Information"
          subheader="View open source licenses"
        >
          <LicenseModal />
        </SectionCard>
      </Box>
    </PageContainer>
  );
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});
