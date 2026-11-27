import { useState } from 'react';
import { DeepPartial } from 'ts-essentials';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  AUTOPILOT_HARD_MAX_OFFSET_F,
  AUTOPILOT_HARD_MAX_STEP_F,
  AUTOPILOT_HARD_MIN_GAP_MIN,
  AutopilotSettings,
} from '@api/settingsSchema.ts';
import { Side, useAppStore } from '@state/appStore.tsx';
import { MAX_TEMP_F, MIN_TEMP_F, formatCelsiusReading, formatTemperature, formatTemperatureDelta } from '@lib/temperatureConversions.ts';
import SettingToggle from '../SettingToggle.tsx';
import AutopilotSlider from './AutopilotSlider.tsx';

// Used when switching the room reference from automatic to a fixed value
const DEFAULT_REFERENCE_C = 21;

type AutopilotSideSettingsProps = {
  side: Side;
  autopilot: AutopilotSettings;
  displayCelsius: boolean;
  disabled: boolean;
  updateAutopilot: (side: Side, autopilot: DeepPartial<AutopilotSettings>) => void;
};

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  return `${Number((minutes / 60).toFixed(1))} h`;
}

// A room temperature difference (°C natively) shown in the user's unit
function formatRoomDelta(deltaC: number, displayCelsius: boolean) {
  return displayCelsius ? `${deltaC.toFixed(1)}°C` : `${(deltaC * 9 / 5).toFixed(1)}°F`;
}

// All autopilot settings for one side: main toggles and sliders, plus an Advanced accordion
export default function AutopilotSideSettings({
  side, autopilot, displayCelsius, disabled, updateAutopilot,
}: AutopilotSideSettingsProps) {
  const { isUpdating } = useAppStore();
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const title = side.charAt(0).toUpperCase() + side.slice(1);
  const controlsDisabled = disabled || isUpdating;
  const save = (partial: DeepPartial<AutopilotSettings>) => updateAutopilot(side, partial);

  return (
    <Box
      sx={ {
        display: 'flex', flexDirection: 'column', gap: 1.5, p: 2,
        border: '1px solid', borderColor: 'divider', borderRadius: 1, minWidth: 0,
      } }
    >
      <Typography component="h3" variant="h6" sx={ { fontSize: 13 } }>{ title } Side</Typography>
      <SettingToggle
        label="Enable autopilot"
        control={
          <Switch
            disabled={ controlsDisabled }
            checked={ autopilot.enabled }
            onChange={ event => save({ enabled: event.target.checked }) }
          />
        }
      />
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        aria-label={ `${title} autopilot mode` }
        value={ autopilot.mode }
        disabled={ controlsDisabled }
        onChange={ (_, mode: AutopilotSettings['mode'] | null) => { if (mode) save({ mode }); } }
      >
        <ToggleButton value="active">Active</ToggleButton>
        <ToggleButton value="shadow">Shadow</ToggleButton>
      </ToggleButtonGroup>
      <AutopilotSlider
        label="Max adjustment"
        value={ autopilot.maxOffsetF }
        min={ 1 }
        max={ AUTOPILOT_HARD_MAX_OFFSET_F }
        step={ 1 }
        disabled={ controlsDisabled }
        formatValue={ value => `±${formatTemperatureDelta(value, displayCelsius, false)}` }
        onCommit={ maxOffsetF => save({ maxOffsetF }) }
      />
      <AutopilotSlider
        label="Hold after manual change"
        value={ autopilot.manualHoldMinutes }
        min={ 30 }
        max={ 720 }
        step={ 30 }
        disabled={ controlsDisabled }
        formatValue={ formatMinutes }
        onCommit={ manualHoldMinutes => save({ manualHoldMinutes }) }
      />
      <SettingToggle
        label="Room compensation"
        control={
          <Switch
            disabled={ controlsDisabled }
            checked={ autopilot.room.enabled }
            onChange={ event => save({ room: { enabled: event.target.checked } }) }
          />
        }
      />
      <SettingToggle
        label="Wake warm-up"
        control={
          <Switch
            disabled={ controlsDisabled }
            checked={ autopilot.wakeWarmup.enabled }
            onChange={ event => save({ wakeWarmup: { enabled: event.target.checked } }) }
          />
        }
      />
      <SettingToggle
        label="Sleep-based cooling (experimental)"
        control={
          <Switch
            disabled={ controlsDisabled }
            checked={ autopilot.vitals.enabled }
            onChange={ event => save({ vitals: { enabled: event.target.checked } }) }
          />
        }
      >
        Uses heart rate, which can be unreliable on some Pods.
      </SettingToggle>

      <Accordion
        expanded={ advancedExpanded }
        onChange={ (_, isExpanded) => setAdvancedExpanded(isExpanded) }
        slotProps={ { transition: { unmountOnExit: true } } }
        sx={ { bgcolor: 'transparent', border: '1px solid', borderColor: 'divider' } }
      >
        <AccordionSummary expandIcon={ <ExpandMoreIcon/> } sx={ { minHeight: 48, px: 2 } }>
          <Typography variant="body2" sx={ { fontWeight: 600 } }>Advanced</Typography>
        </AccordionSummary>
        <AccordionDetails sx={ { px: 2, display: 'flex', flexDirection: 'column', gap: 1.5 } }>
          <AutopilotSlider
            label="Room gain"
            value={ autopilot.room.gainFPerC }
            min={ 0 }
            max={ 2 }
            step={ 0.1 }
            disabled={ controlsDisabled }
            formatValue={ value => (displayCelsius ? `${(value * 5 / 9).toFixed(1)}°C per °C` : `${value.toFixed(1)}°F per °C`) }
            onCommit={ gainFPerC => save({ room: { gainFPerC } }) }
          />
          <AutopilotSlider
            label="Room deadband"
            value={ autopilot.room.deadbandC }
            min={ 0 }
            max={ 2 }
            step={ 0.1 }
            disabled={ controlsDisabled }
            formatValue={ value => `±${formatRoomDelta(value, displayCelsius)}` }
            onCommit={ deadbandC => save({ room: { deadbandC } }) }
          />
          <SettingToggle
            label="Automatic room reference"
            control={
              <Switch
                disabled={ controlsDisabled }
                checked={ autopilot.room.referenceC === null }
                onChange={ event => save({ room: { referenceC: event.target.checked ? null : DEFAULT_REFERENCE_C } }) }
              />
            }
          >
            Captures the room temperature each night when the bed turns on, and again after any manual change.
          </SettingToggle>
          { autopilot.room.referenceC !== null && (
            <AutopilotSlider
              label="Reference room temperature"
              value={ autopilot.room.referenceC }
              min={ 15 }
              max={ 30 }
              step={ 0.5 }
              disabled={ controlsDisabled }
              formatValue={ value => formatCelsiusReading(value, displayCelsius) }
              onCommit={ referenceC => save({ room: { referenceC } }) }
            />
          ) }
          <AutopilotSlider
            label="Step per change"
            value={ autopilot.stepF }
            min={ 1 }
            max={ AUTOPILOT_HARD_MAX_STEP_F }
            step={ 1 }
            disabled={ controlsDisabled }
            formatValue={ value => formatTemperatureDelta(value, displayCelsius, false) }
            onCommit={ stepF => save({ stepF }) }
          />
          <AutopilotSlider
            label="Minimum time between changes"
            value={ autopilot.minMinutesBetweenChanges }
            min={ AUTOPILOT_HARD_MIN_GAP_MIN }
            max={ 120 }
            step={ 5 }
            disabled={ controlsDisabled }
            formatValue={ formatMinutes }
            onCommit={ minMinutesBetweenChanges => save({ minMinutesBetweenChanges }) }
          />
          <AutopilotSlider
            label="Allowed temperature range"
            value={ [autopilot.absoluteMinF, autopilot.absoluteMaxF] }
            min={ MIN_TEMP_F }
            max={ MAX_TEMP_F }
            step={ 1 }
            disabled={ controlsDisabled }
            formatValue={ ([low, high]) => `${formatTemperature(low, displayCelsius)} – ${formatTemperature(high, displayCelsius)}` }
            onCommit={ ([absoluteMinF, absoluteMaxF]) => save({ absoluteMinF, absoluteMaxF }) }
          />
          <AutopilotSlider
            label="Wake warm-up window"
            value={ autopilot.wakeWarmup.minutes }
            min={ 10 }
            max={ 90 }
            step={ 5 }
            disabled={ controlsDisabled }
            formatValue={ formatMinutes }
            onCommit={ minutes => save({ wakeWarmup: { minutes } }) }
          />
          <AutopilotSlider
            label="Wake warm-up amount"
            value={ autopilot.wakeWarmup.deltaF }
            min={ 0 }
            max={ 4 }
            step={ 1 }
            disabled={ controlsDisabled }
            formatValue={ value => formatTemperatureDelta(value, displayCelsius) }
            onCommit={ deltaF => save({ wakeWarmup: { deltaF } }) }
          />
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
