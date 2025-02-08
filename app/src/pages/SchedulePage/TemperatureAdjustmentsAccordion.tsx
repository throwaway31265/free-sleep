import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  TextField,
  Typography,
  IconButton,
  Select,
  MenuItem,
} from '@mui/material';
import { Add, ExpandMore, Remove } from '@mui/icons-material';
import _ from 'lodash';
import moment from 'moment-timezone';
import { useScheduleStore } from './scheduleStore';
import { useAppStore } from '@state/appStore.tsx';
import { DailySchedule } from '@api/schedulesSchema.ts';
import ThermostatIcon from '@mui/icons-material/Thermostat';

// There's probably a better way to share this function - I just don't know what it is
import { formatTemperature } from '../ControlTempPage/TemperatureLabel';
const ACCORDION_NAME = 'temperatureAdjustments';
const TEMPERATURES_LIST = _.range(55, 111); // Generates a range from 55 to 110 inclusive

export default function TemperatureAdjustmentsAccordion({ displayCelsius }: { displayCelsius: boolean }) {
  const {
    accordionExpanded,
    selectedSchedule,
    updateSelectedSchedule,
    setAccordionExpanded,
    updateSelectedTemperatures,
  } = useScheduleStore();
  const { isUpdating } = useAppStore();


  // Add a new schedule with default values
  const addSchedule = () => {
    if (!selectedSchedule) return;
    const scheduleKeys = Object.keys(selectedSchedule.temperatures);
    const lastTime = scheduleKeys.length > 0
      ? moment(scheduleKeys[scheduleKeys.length - 1], 'HH:mm')
      : moment(selectedSchedule.power.on, 'HH:mm');
    const nextTime = lastTime.add(1, 'hour').format('HH:mm');

    if (!scheduleKeys.includes(nextTime)) {
      updateSelectedSchedule({
        temperatures: {
          ...selectedSchedule.temperatures,
          [nextTime]: 70,
        }
      });
    }
  };

  const handleUpdateTime = (oldTime: string, newTime: string) => {
    if (!selectedSchedule) return;
    const existingTemperature = selectedSchedule.temperatures[oldTime];
    const temperaturesCopy: DailySchedule['temperatures'] = { ...selectedSchedule.temperatures };
    delete temperaturesCopy[oldTime];
    temperaturesCopy[newTime] = existingTemperature;
    updateSelectedTemperatures(temperaturesCopy);
  };

  const handleUpdateTemperature = (time: string, temperature: number) => {
    if (!selectedSchedule) return;
    const temperaturesCopy: DailySchedule['temperatures'] = { ...selectedSchedule.temperatures };
    temperaturesCopy[time] = temperature;
    updateSelectedTemperatures(temperaturesCopy);
  };

  // Remove a schedule by time
  const deleteTime = (time: string) => {
    if(!selectedSchedule) return;
    const temperaturesCopy: DailySchedule['temperatures'] = { ...selectedSchedule.temperatures };
    delete temperaturesCopy[time];
    updateSelectedTemperatures(temperaturesCopy);
  };

  // Validate if the time is within the allowed range
  const isTimeValid = (time: string): boolean => {
    if (!selectedSchedule) return false;
    const timeMoment = moment(time, 'HH:mm');
    const powerOnMoment = moment(selectedSchedule.power.on, 'HH:mm');
    const powerOffMoment = moment(selectedSchedule.power.off, 'HH:mm');

    if (powerOffMoment.isBefore(powerOnMoment)) {
      // Overnight schedule
      return timeMoment.isAfter(powerOnMoment) || timeMoment.isBefore(powerOffMoment);
    } else {
      // Same day schedule
      return timeMoment.isSameOrAfter(powerOnMoment) && timeMoment.isSameOrBefore(powerOffMoment);
    }
  };

  return (
    <Accordion
      sx={ { width: '100%' } }
      expanded={ accordionExpanded === ACCORDION_NAME }
      onChange={ () => setAccordionExpanded(ACCORDION_NAME) }
    >
      <AccordionSummary expandIcon={ <ExpandMore/> } >
        <Typography sx={ { alignItems: 'center', display: 'flex', gap: 3 } }>
          <ThermostatIcon /> Temperature adjustments
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        { /* Dynamic schedule rows */ }
        {
          selectedSchedule && Object.entries(selectedSchedule.temperatures)
            .sort(([timeA], [timeB]) => {
              const powerOnMoment = moment(selectedSchedule.power.on, 'HH:mm');
              const momentA = moment(timeA, 'HH:mm');
              const momentB = moment(timeB, 'HH:mm');

              // Adjust times relative to `powerOnTime`
              const adjustedA = momentA.isBefore(powerOnMoment) ? momentA.add(1, 'day') : momentA;
              const adjustedB = momentB.isBefore(powerOnMoment) ? momentB.add(1, 'day') : momentB;

              return adjustedA.diff(powerOnMoment) - adjustedB.diff(powerOnMoment);
            })
            .map(([time, temperature]) => (
              <Box
                key={ time }
                sx={ {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                  gap: 1,
                } }
              >
                { /* Time selector */ }
                <TextField
                  label="Time"
                  type="time"
                  value={ time }
                  sx={ { flexGrow: 1 } }
                  onChange={ (event) => handleUpdateTime(time, event.target.value) }
                  error={ !isTimeValid(time) }
                  helperText={
                    !isTimeValid(time)
                      ? `Time must be between ${selectedSchedule?.power.on} and ${selectedSchedule?.power.off}`
                      : ''
                  }
                  disabled={ isUpdating }
                />

                { /* Temperature selector */ }
                <Select
                  value={ temperature }
                  onChange={ (event) =>
                    handleUpdateTemperature(time, event.target.value as number)
                  }
                  sx={ { width: '110px' } }
                  disabled={ isUpdating }
                >
                  {
                    TEMPERATURES_LIST.map((temp) => (
                      <MenuItem key={ temp } value={ temp }>
                        { formatTemperature(temp, displayCelsius) }
                      </MenuItem>
                    ))
                  }
                </Select>

                { /* Remove button */ }
                <IconButton
                  onClick={ () => deleteTime(time) }
                  color="error"
                  aria-label="remove schedule"
                  disabled={ isUpdating }
                >
                  <Remove/>
                </IconButton>
              </Box>
            )) }

        { /* Add schedule button */ }
        <Box sx={ { display: 'flex', justifyContent: 'center', mt: 2 } }>
          <Button
            variant="contained"
            startIcon={ <Add/> }
            onClick={ addSchedule }
            disabled={ isUpdating }
          >
            Add schedule
          </Button>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
