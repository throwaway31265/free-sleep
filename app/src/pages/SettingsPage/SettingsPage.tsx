import { DeepPartial } from 'ts-essentials';
import { Box, Divider } from '@mui/material';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined';
import SideSettings from './SideSettings.tsx';
import PageContainer from '../PageContainer.tsx';
import { Settings } from '@api/settingsSchema.ts';
import { postSettings, useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import DailyPriming from './DailyPriming.tsx';
import LicenseModal from './LicenseModal.tsx';
import PrimeControl from './PrimeControl.tsx';
import Donate from './Donate.tsx';
import DiscordLink from './DiscordLink.tsx';
import FeaturesSection from './FeaturesSection/FeaturesSection.tsx';
import Section from './Section.tsx';
import SettingsHint from './SettingsHint.tsx';
import DeviceSettingsSection from './DeviceSettingsSection/DeviceSettingsSection.tsx';
import DeviceInfo from './DeviceSettingsSection/DeviceInfo.tsx';
import DailyReboot from './DeviceSettingsSection/DailyReboot.tsx';
import ErrorBoundary from '@components/ErrorBoundary.tsx';
import PageHeader from '@components/PageHeader.tsx';
import ConnectionBadge from '@components/ConnectionBadge.tsx';

export default function SettingsPage() {
  const { data: settings, refetch } = useSettings();
  const { setIsUpdating } = useAppStore();

  const updateSettings = (settings: DeepPartial<Settings>) => {
    setIsUpdating(true);

    postSettings(settings)
      .then(() => refetch())
      .catch(error => {
        console.error(error);
      })
      .finally(() => setIsUpdating(false));
  };

  return (
    <PageContainer sx={ { maxWidth: 760, gap: 2.5 } }>
      <PageHeader title="Settings">
        <Box sx={ { display: { xs: 'flex', md: 'none' } } }><ConnectionBadge/></Box>
      </PageHeader>
      <ErrorBoundary componentName="Device settings">
        <DeviceSettingsSection updateSettings={ updateSettings }/>
      </ErrorBoundary>
      <ErrorBoundary componentName="Side settings">
        <Section title="Side settings" icon={ <BedOutlinedIcon/> }>
          <Box sx={ { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 } }>
            <SideSettings side="left" settings={ settings } updateSettings={ updateSettings }/>
            <SideSettings side="right" settings={ settings } updateSettings={ updateSettings }/>
          </Box>
          <Box sx={ { mt: 2 } }>
            <SettingsHint>
              Away mode:
              Disables schedules and temperature control for one side.
              That side will mirror any temperature or schedule changes from the active side.
              If both sides are in away mode, no schedules will apply.
            </SettingsHint>
          </Box>
        </Section>
      </ErrorBoundary>
      <ErrorBoundary componentName="Priming settings">
        <Section title="Priming" icon={ <WaterDropOutlinedIcon/> }>
          <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>
            <DailyPriming settings={ settings } updateSettings={ updateSettings }/>
            <Divider/>
            <Box sx={ { '& > .MuiButton-root': { width: '100%' } } }><PrimeControl/></Box>
            <SettingsHint>
              Regular priming helps prevent air bubbles, ensures even cooling and heating.
              Schedule priming during a time that you're not on the bed.
            </SettingsHint>
          </Box>
        </Section>
      </ErrorBoundary>
      <FeaturesSection/>
      <ErrorBoundary componentName="Device info">
        <Section title="Device" icon={ <MemoryOutlinedIcon/> }>
          <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2.5 } }>
            <DeviceInfo/>
            <Divider/>
            <DailyReboot settings={ settings } updateSettings={ updateSettings }/>
          </Box>
        </Section>
      </ErrorBoundary>
      <ErrorBoundary componentName="Info section">
        <DiscordLink/>
        <Donate/>
        <LicenseModal/>
      </ErrorBoundary>
    </PageContainer>
  );
}
