import { Alert, Box } from '@mui/material';
import { DeepPartial } from 'ts-essentials';
import AutoModeRoundedIcon from '@mui/icons-material/AutoModeRounded';
import { AutopilotSettings, Settings } from '@api/settingsSchema.ts';
import { Side } from '@state/appStore.tsx';
import { formatTemperatureDelta } from '@lib/temperatureConversions.ts';
import Section from '../Section.tsx';
import SettingsHint from '../SettingsHint.tsx';
import AutopilotSideSettings, { formatMinutes } from './AutopilotSideSettings.tsx';

type AutopilotSectionProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

const SIDES: Side[] = ['left', 'right'];

// Joins two per-side labels, collapsing them when both sides match
function describeSides(leftLabel: string, rightLabel: string) {
  return leftLabel === rightLabel ? leftLabel : `${leftLabel} (left) / ${rightLabel} (right)`;
}

export default function AutopilotSection({ settings, updateSettings }: AutopilotSectionProps) {
  // Older servers (or a rolled-back one) have no autopilot settings: show nothing
  if (!settings?.left?.autopilot || !settings?.right?.autopilot) return null;

  const displayCelsius = settings.temperatureFormat === 'celsius';
  // Autopilot never acts while either side is away, so the controls are locked too
  const awayModeOn = settings.left.awayMode || settings.right.awayMode;
  const updateAutopilot = (side: Side, autopilot: DeepPartial<AutopilotSettings>) => updateSettings({ [side]: { autopilot } });

  const maxOffsetLabel = describeSides(
    formatTemperatureDelta(settings.left.autopilot.maxOffsetF, displayCelsius, false),
    formatTemperatureDelta(settings.right.autopilot.maxOffsetF, displayCelsius, false),
  );
  const holdLabel = describeSides(
    formatMinutes(settings.left.autopilot.manualHoldMinutes),
    formatMinutes(settings.right.autopilot.manualHoldMinutes),
  );

  return (
    <Section title="Autopilot" icon={ <AutoModeRoundedIcon/> }>
      { awayModeOn && (
        <Alert severity="info" sx={ { mb: 2 } }>
          Autopilot is unavailable while away mode is on for either side.
        </Alert>
      ) }
      <Box sx={ { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 } }>
        { SIDES.map(side => (
          <AutopilotSideSettings
            key={ side }
            side={ side }
            autopilot={ settings[side].autopilot }
            displayCelsius={ displayCelsius }
            disabled={ awayModeOn }
            updateAutopilot={ updateAutopilot }
          />
        )) }
      </Box>
      <Box sx={ { mt: 2 } }>
        <SettingsHint>
          Autopilot only nudges up to ±{ maxOffsetLabel } around the temperature you or your schedule set.
          Any dial change or tap pauses it for { holdLabel }.
          Switch to Shadow to only log what it would do.
        </SettingsHint>
      </Box>
    </Section>
  );
}
