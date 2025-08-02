import type { BaseElevation, DailySchedule } from '@api/schedulesSchema';
import { Add, ExpandMore, Remove } from '@mui/icons-material';
import AirlineSeatFlatAngledIcon from '@mui/icons-material/AirlineSeatFlatAngled';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import _ from 'lodash';
import moment from 'moment-timezone';
import { useState } from 'react';
import { useScheduleStore } from './scheduleStore';

const ACCORDION_NAME = 'elevationAdjustments';

const BASE_PRESETS = {
  flat: { head: 0, feet: 0 },
  sleep: { head: 1, feet: 5 },
  relax: { head: 30, feet: 15 },
  read: { head: 40, feet: 0 },
} as const;

type PresetKey = keyof typeof BASE_PRESETS;

export default function ElevationAdjustmentsAccordion() {
  const {
    accordionExpanded,
    selectedSchedule,
    setAccordionExpanded,
    updateSelectedElevations,
  } = useScheduleStore();
  const { isUpdating } = useAppStore();

  // Add a new schedule with default values
  const addSchedule = () => {
    if (!selectedSchedule) return;
    const scheduleKeys = Object.keys(selectedSchedule.elevations);
    const lastTime =
      scheduleKeys.length > 0
        ? moment(scheduleKeys[scheduleKeys.length - 1], 'HH:mm')
        : moment(selectedSchedule.power.on, 'HH:mm');
    const nextTime = lastTime.add(1, 'hour').format('HH:mm');

    if (!scheduleKeys.includes(nextTime)) {
      const elevationsCopy: DailySchedule['elevations'] = {
        ...selectedSchedule.elevations,
        [nextTime]: { preset: 'flat' },
      };
      updateSelectedElevations(elevationsCopy);
    }
  };

  const handleUpdateTime = (oldTime: string, newTime: string) => {
    if (!selectedSchedule) return;
    const existingElevation = selectedSchedule.elevations[oldTime];
    const elevationsCopy: DailySchedule['elevations'] = {
      ...selectedSchedule.elevations,
    };
    delete elevationsCopy[oldTime];
    elevationsCopy[newTime] = existingElevation;
    updateSelectedElevations(elevationsCopy);
  };

  const handleUpdateElevation = (time: string, elevation: BaseElevation) => {
    if (!selectedSchedule) return;
    const elevationsCopy: DailySchedule['elevations'] = {
      ...selectedSchedule.elevations,
    };
    elevationsCopy[time] = elevation;
    updateSelectedElevations(elevationsCopy);
  };

  // Remove a schedule by time
  const deleteTime = (time: string) => {
    if (!selectedSchedule) return;
    const elevationsCopy: DailySchedule['elevations'] = {
      ...selectedSchedule.elevations,
    };
    delete elevationsCopy[time];
    updateSelectedElevations(elevationsCopy);
  };

  // Validate if the time is within the allowed range
  const isTimeValid = (time: string): boolean => {
    if (!selectedSchedule) return false;
    const timeMoment = moment(time, 'HH:mm');
    const powerOnMoment = moment(selectedSchedule.power.on, 'HH:mm');
    const powerOffMoment = moment(selectedSchedule.power.off, 'HH:mm');

    if (powerOffMoment.isBefore(powerOnMoment)) {
      // Overnight schedule
      return (
        timeMoment.isAfter(powerOnMoment) || timeMoment.isBefore(powerOffMoment)
      );
    } else {
      // Same day schedule
      return (
        timeMoment.isSameOrAfter(powerOnMoment) &&
        timeMoment.isSameOrBefore(powerOffMoment)
      );
    }
  };

  // Component for elevation input (preset or custom)
  const ElevationInput = ({ 
    time, 
    elevation 
  }: { 
    time: string; 
    elevation: BaseElevation 
  }) => {
    const [inputMode, setInputMode] = useState<'preset' | 'custom'>(
      'preset' in elevation ? 'preset' : 'custom'
    );

    const handleModeChange = (
      _event: React.MouseEvent<HTMLElement>,
      newMode: 'preset' | 'custom'
    ) => {
      if (newMode !== null) {
        setInputMode(newMode);
        if (newMode === 'preset') {
          handleUpdateElevation(time, { preset: 'flat' });
        } else {
          handleUpdateElevation(time, { head: 0, feet: 0, feedRate: 50 });
        }
      }
    };

    const handlePresetChange = (preset: PresetKey) => {
      handleUpdateElevation(time, { preset });
    };

    const handleCustomChange = (field: 'head' | 'feet' | 'feedRate', value: number) => {
      if ('preset' in elevation) return;
      handleUpdateElevation(time, {
        ...elevation,
        [field]: value,
      });
    };

    return (
      <Stack spacing={2}>
        <ToggleButtonGroup
          value={inputMode}
          exclusive
          onChange={handleModeChange}
          size="small"
        >
          <ToggleButton value="preset">Preset</ToggleButton>
          <ToggleButton value="custom">Custom</ToggleButton>
        </ToggleButtonGroup>

        {inputMode === 'preset' ? (
          <FormControl fullWidth>
            <InputLabel>Preset</InputLabel>
            <Select
              value={'preset' in elevation ? elevation.preset : 'flat'}
              onChange={(event) => handlePresetChange(event.target.value as PresetKey)}
              disabled={isUpdating}
            >
              {Object.entries(BASE_PRESETS).map(([preset, position]) => (
                <MenuItem key={preset} value={preset}>
                  {preset.charAt(0).toUpperCase() + preset.slice(1)} ({position.head}° • {position.feet}°)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Stack direction="row" spacing={1}>
            <TextField
              label="Head (°)"
              type="number"
              value={'preset' in elevation ? 0 : elevation.head}
              onChange={(event) => 
                handleCustomChange('head', Number(event.target.value))
              }
              inputProps={{ min: 0, max: 60 }}
              disabled={isUpdating}
              size="small"
            />
            <TextField
              label="Feet (°)"
              type="number"
              value={'preset' in elevation ? 0 : elevation.feet}
              onChange={(event) => 
                handleCustomChange('feet', Number(event.target.value))
              }
              inputProps={{ min: 0, max: 45 }}
              disabled={isUpdating}
              size="small"
            />
            <TextField
              label="Speed"
              type="number"
              value={'preset' in elevation ? 50 : elevation.feedRate || 50}
              onChange={(event) => 
                handleCustomChange('feedRate', Number(event.target.value))
              }
              inputProps={{ min: 30, max: 100 }}
              disabled={isUpdating}
              size="small"
            />
          </Stack>
        )}
      </Stack>
    );
  };

  return (
    <Accordion
      sx={{ width: '100%' }}
      expanded={accordionExpanded === ACCORDION_NAME}
      onChange={() => setAccordionExpanded(ACCORDION_NAME)}
    >
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Typography sx={{ alignItems: 'center', display: 'flex', gap: 3 }}>
          <AirlineSeatFlatAngledIcon /> Elevation adjustments
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {/* Dynamic schedule rows */}
        {selectedSchedule &&
          Object.entries(selectedSchedule.elevations)
            .sort(([timeA], [timeB]) => {
              const powerOnMoment = moment(selectedSchedule.power.on, 'HH:mm');
              const momentA = moment(timeA, 'HH:mm');
              const momentB = moment(timeB, 'HH:mm');

              // Adjust times relative to `powerOnTime`
              const adjustedA = momentA.isBefore(powerOnMoment)
                ? momentA.add(1, 'day')
                : momentA;
              const adjustedB = momentB.isBefore(powerOnMoment)
                ? momentB.add(1, 'day')
                : momentB;

              return (
                adjustedA.diff(powerOnMoment) - adjustedB.diff(powerOnMoment)
              );
            })
            .map(([time, elevation]) => (
              <Box
                key={time}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  mb: 2,
                  gap: 2,
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                {/* Time selector */}
                <TextField
                  label="Time"
                  type="time"
                  value={time}
                  sx={{ minWidth: '120px' }}
                  onChange={(event) =>
                    handleUpdateTime(time, event.target.value)
                  }
                  error={!isTimeValid(time)}
                  helperText={
                    !isTimeValid(time)
                      ? `Time must be between ${selectedSchedule?.power.on} and ${selectedSchedule?.power.off}`
                      : ''
                  }
                  disabled={isUpdating}
                  size="small"
                />

                {/* Elevation configuration */}
                <Box sx={{ flexGrow: 1 }}>
                  <ElevationInput time={time} elevation={elevation} />
                </Box>

                {/* Remove button */}
                <IconButton
                  onClick={() => deleteTime(time)}
                  color="error"
                  aria-label="remove schedule"
                  disabled={isUpdating}
                  sx={{ mt: 1 }}
                >
                  <Remove />
                </IconButton>
              </Box>
            ))}

        {/* Add schedule button */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={addSchedule}
            disabled={isUpdating}
          >
            Add elevation schedule
          </Button>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}