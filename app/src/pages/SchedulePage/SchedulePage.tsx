import _ from 'lodash';
import { useEffect } from 'react';
import { Box } from '@mui/material';
import { DeepPartial } from 'ts-essentials';
import moment from 'moment-timezone';

import AlarmAccordion from './AlarmAccordion.tsx';
import ApplyToOtherDaysAccordion from './ApplyToOtherDaysAccordion.tsx';
import DayTabs from './DayTabs.tsx';
import EnabledSwitch from './EnabledSwitch.tsx';
import EndTime from './EndTime.tsx';
import PageContainer from '../PageContainer.tsx';
import SaveButton from './SaveButton.tsx';
import SideControl from '../../components/SideControl.tsx';
import StartTimeSection from './StartTimeSection.tsx';
import TemperatureAdjustmentsAccordion from './TemperatureAdjustmentsAccordion.tsx';
import { DayOfWeek, Schedules } from '@api/schedulesSchema.ts';
import { postSchedules } from '@api/schedules';
import { useAppStore } from '@state/appStore.tsx';
import { useSchedules } from '@api/schedules';
import { useScheduleStore } from './scheduleStore.tsx';
import { useSettings } from '@api/settings';
import { LOWERCASE_DAYS } from './days.ts';


const getAdjustedDayOfWeek = (): DayOfWeek => {
  // Get the current moment in the specified timezone
  const now = moment();
  // Extract the hour of the day in 24-hour format
  const currentHour = now.hour();

  // Determine if it's before noon (12:00 PM)
  if (currentHour < 12) {
    return now.subtract(1, 'day').format('dddd').toLocaleLowerCase() as DayOfWeek;
  } else {
    return now.format('dddd').toLocaleLowerCase() as DayOfWeek;
  }
};


export default function SchedulePage() {
  const { setIsUpdating, side } = useAppStore();
  const { data: schedules, refetch } = useSchedules();
  const {
    selectedSchedule,
    setOriginalSchedules,
    selectedDays,
    selectedDay,
    reloadScheduleData,
    selectDay
  } = useScheduleStore();
  const { data: settings } = useSettings();
  const displayCelsius = settings?.temperatureFormat === 'celsius';
  // TODO: Add changes lost notification using changesPresent when user tries to switch tab before saving

  useEffect(() => {
    const day = getAdjustedDayOfWeek();
    selectDay(LOWERCASE_DAYS.indexOf(day));
  }, []);

  useEffect(() => {
    if (!schedules) return;
    setOriginalSchedules(schedules);
    const day = getAdjustedDayOfWeek();
    selectDay(LOWERCASE_DAYS.indexOf(day));
    reloadScheduleData();
  }, [schedules]);

  useEffect(() => {
    reloadScheduleData();
  }, [side]);

  const handleSave = async () => {
    setIsUpdating(true);

    // @ts-ignore
    const daysList: DayOfWeek[] = _.uniq(_.keys(_.pickBy(selectedDays, value => value)));
    daysList.push(selectedDay);
    const payload: DeepPartial<Schedules> = { [side]: {}, };
    daysList.forEach(day => {
      // @ts-ignore
      payload[side][day] = selectedSchedule;
    });

    await postSchedules(payload)
      .then(() => {
        // Wait 1 second before refreshing the schedules
        return new Promise((resolve) => setTimeout(resolve, 1_000));
      })
      .then(() => refetch())
      .catch(error => {
        console.error(error);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };

  return (
    <PageContainer
      sx={ {
        width: '100%',
        maxWidth: { xs: '100%', sm: '800px' },
        mx: 'auto',
        mb: 15,
      } }
    >
      <SideControl title={ 'Schedules' }/>
      <DayTabs/>
      <StartTimeSection displayCelsius={ displayCelsius }/>
      <EndTime/>
      <Box sx={ { mt: 2, display: 'flex', justifyContent: 'space-between', width: '100%', mb: 2 } }>
        <EnabledSwitch/>
        <SaveButton onSave={ handleSave }/>
      </Box>
      {
        selectedSchedule?.power.enabled && (
          <>
            <TemperatureAdjustmentsAccordion displayCelsius={ displayCelsius }/>
            <AlarmAccordion/>
            <ApplyToOtherDaysAccordion/>
          </>
        )
      }
    </PageContainer>
  );
}
