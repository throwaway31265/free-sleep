import {
  Accordion,
  AccordionSummary,
  Box,
  Typography,
  SxProps,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AccordionExpanded } from './SchedulePage.types.ts';
import { useScheduleStore } from './scheduleStore';
import AlarmEnabledSwitch from './AlarmEnabledSwitch.tsx';
import AlarmTime from './AlarmTime.tsx';
import AlarmVibrationSlider from './AlarmVibrationSlider.tsx';
import AlarmDuration from './AlarmDuration.tsx';
import AlarmPattern from './AlarmPattern.tsx';
import React from 'react';
import AlarmIcon from '@mui/icons-material/Alarm';

const ACCORDION_NAME: AccordionExpanded = 'alarm';

const Row = ({ children, sx }: React.PropsWithChildren<{ sx?: SxProps }>) => (
  <Box
    sx={ {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      mb: 2,
      pl: 2,
      pr: 2,
      gap: 1,
      ...sx,
    } }
  >
    { children }
  </Box>
);

// eslint-disable-next-line react/no-multi-comp
export default function AlarmAccordion() {
  const {
    accordionExpanded,
    selectedSchedule,
    setAccordionExpanded,
  } = useScheduleStore();


  return (
    <Accordion
      sx={ { width: '100%', mt: -2 } }
      expanded={ accordionExpanded === ACCORDION_NAME }
      onChange={ () => setAccordionExpanded(ACCORDION_NAME) }
    >
      <AccordionSummary expandIcon={ <ExpandMoreIcon/> } >
        <Typography sx={ { display: 'flex', alignItems: 'center', gap: 3 } }>
          <AlarmIcon /> Vibration alarm
        </Typography>
      </AccordionSummary>
      <Box sx={ { width: '100%' } }>
        <Row>
          <AlarmEnabledSwitch/>
          { selectedSchedule?.alarm.enabled && <AlarmTime/> }
        </Row>
        {
          selectedSchedule?.alarm.enabled &&
          (
            <Row>
              <AlarmDuration/>
              <AlarmPattern/>
            </Row>
          )
        }
        {
          selectedSchedule?.alarm.enabled &&
          (
            <Row sx={ { ml: 3, mr: 3 } }>
              <AlarmVibrationSlider/>
            </Row>
          )
        }
      </Box>
    </Accordion>
  );

}
