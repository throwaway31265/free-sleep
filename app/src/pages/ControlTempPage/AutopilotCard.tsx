import { useState } from 'react';
import moment from 'moment-timezone';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  ChipProps,
  Paper,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AutoModeRoundedIcon from '@mui/icons-material/AutoModeRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AutopilotSideStatus, useAutopilotActions, useAutopilotStatus } from '@api/autopilot.ts';
import { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import AutopilotDecisionList from './AutopilotDecisionList.tsx';
import { describeDecision } from './describeDecision.ts';
import { formatCelsiusReading, formatTemperature, formatTemperatureDelta } from '@lib/temperatureConversions.ts';

const PAUSE_MINUTES = 60;

type AutopilotCardProps = {
  settings?: Settings;
};

type ChipInfo = { label: string; color: ChipProps['color'] };

// Maps the runtime state to a status chip; hold / pause show when they end
function getChipInfo(status: AutopilotSideStatus, now: number): ChipInfo {
  const formatClock = (epochMs: number) => moment(epochMs).format('HH:mm');
  switch (status.state) {
  case 'ACTIVE':
    return { label: 'Active', color: 'success' };
  case 'SHADOW':
    return { label: 'Shadow', color: 'info' };
  case 'HOLD':
    return status.holdUntil && status.holdUntil > now
      ? { label: `Holding until ${formatClock(status.holdUntil)}`, color: 'warning' }
      : { label: 'Holding', color: 'warning' };
  case 'PAUSED':
    return status.pausedUntil && status.pausedUntil > now
      ? { label: `Paused until ${formatClock(status.pausedUntil)}`, color: 'warning' }
      : { label: 'Paused', color: 'warning' };
  case 'SETTLING':
    return { label: 'Settling', color: 'default' };
  case 'FAULT':
    return { label: 'Fault', color: 'error' };
  case 'OFF':
    return { label: 'Off', color: 'default' };
  default:
    return { label: 'Idle', color: 'default' };
  }
}

// Headline when there is no anchor yet; only claim the bed is off when that is the reason
function getIdleHeadline(skippedBecause: string | null): string {
  switch (skippedBecause) {
  case 'side is off':
    return 'Waiting for the bed to turn on';
  case 'pod is priming':
    return 'Idle while the pod primes';
  case 'alarm is vibrating':
    return 'Idle during the alarm';
  case 'away':
    return 'Idle while away mode is on';
  case 'device read failed':
    return 'Cannot reach the pod right now';
  default:
    return 'Not adjusting right now';
  }
}

// Human readable age of the newest room sample
function formatAge(ageSeconds: number) {
  if (ageSeconds < 90) return `${Math.round(ageSeconds)} s ago`;
  if (ageSeconds < 90 * 60) return `${Math.round(ageSeconds / 60)} min ago`;
  return `${Math.round(ageSeconds / 3600)} h ago`;
}

// Compact autopilot status for the current side, shown under the temperature dial
export default function AutopilotCard({ settings }: AutopilotCardProps) {
  const { side, isUpdating } = useAppStore();
  const autopilotEnabled = settings?.[side]?.autopilot?.enabled ?? false;
  const { data: autopilotStatus } = useAutopilotStatus(autopilotEnabled);
  const { pause, resume } = useAutopilotActions();
  const [expanded, setExpanded] = useState(false);

  const status = autopilotStatus?.[side];
  if (!autopilotEnabled || !status) return null;

  const now = Date.now();
  const displayCelsius = settings?.temperatureFormat === 'celsius';
  const chip = getChipInfo(status, now);
  const isPaused = status.state === 'PAUSED' || (status.pausedUntil !== null && status.pausedUntil > now);
  const lastDecision = status.decisions[status.decisions.length - 1];
  const lastSentence = lastDecision ? describeDecision(lastDecision, displayCelsius) : null;
  const { ambientC, humidity, envAgeS } = status.inputs;

  let setpointLine = getIdleHeadline(lastDecision?.skippedBecause ?? null);
  if (status.anchorF !== null) {
    const setpoint = formatTemperature(status.anchorF, displayCelsius);
    const adjusted = formatTemperature(status.anchorF + status.appliedOffset, displayCelsius);
    const offset = formatTemperatureDelta(status.appliedOffset, displayCelsius);
    const verb = status.offsetIsVirtual ? 'would set' : 'autopilot';
    setpointLine = status.appliedOffset === 0
      ? `Set ${setpoint}, no adjustment`
      : `Set ${setpoint}, ${verb} ${adjusted} (${offset})`;
  }

  const roomParts = [
    ambientC !== null ? `Room ${formatCelsiusReading(ambientC, displayCelsius)}` : 'No room data',
    humidity !== null ? `${Math.round(humidity)}% RH` : null,
    envAgeS !== null ? formatAge(envAgeS) : null,
  ].filter(Boolean);

  return (
    <Paper sx={ { borderRadius: '20px', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 } }>
      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 } }>
        <Box sx={ { display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 } }>
          <Box
            sx={ theme => ({
              display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: '10px', flexShrink: 0,
              color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.12),
              '& .MuiSvgIcon-root': { fontSize: 18 },
            }) }
          >
            <AutoModeRoundedIcon/>
          </Box>
          <Typography component="h2" variant="h6" noWrap>Autopilot</Typography>
        </Box>
        <Chip label={ chip.label } color={ chip.color } size="small"/>
      </Box>

      <Box sx={ { minWidth: 0 } }>
        <Typography variant="body1" sx={ { fontWeight: 600 } }>{ setpointLine }</Typography>
        { lastSentence && (
          <Typography variant="body2" sx={ { color: 'text.secondary', mt: 0.5, fontSize: 12.5, lineHeight: 1.55 } }>
            { lastSentence }
          </Typography>
        ) }
        <Typography variant="caption" sx={ { color: 'text.secondary', display: 'block', mt: 0.75 } }>
          { roomParts.join(' · ') }
        </Typography>
      </Box>

      <Button
        fullWidth
        variant="outlined"
        disabled={ isUpdating }
        onClick={ () => (isPaused ? resume(side) : pause(side, PAUSE_MINUTES)) }
        sx={ { minHeight: 46 } }
      >
        { isPaused ? 'Resume' : 'Pause 1 h' }
      </Button>

      <Accordion
        expanded={ expanded }
        onChange={ (_, isExpanded) => setExpanded(isExpanded) }
        slotProps={ { transition: { unmountOnExit: true } } }
        sx={ { bgcolor: 'transparent', border: '1px solid', borderColor: 'divider' } }
      >
        <AccordionSummary expandIcon={ <ExpandMoreIcon/> } sx={ { minHeight: 48, px: 2 } }>
          <Typography variant="body2" sx={ { fontWeight: 600 } }>Recent decisions</Typography>
        </AccordionSummary>
        <AccordionDetails sx={ { px: 2 } }>
          <AutopilotDecisionList decisions={ status.decisions } displayCelsius={ displayCelsius }/>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
}
