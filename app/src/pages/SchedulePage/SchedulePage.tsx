import _ from 'lodash';
import { useEffect } from 'react';
import { Box } from '@mui/material';
import { DeepPartial } from 'ts-essentials';

import { useSchedules } from '@api/schedules';
import SideControl from './SideControl.tsx';
import PageContainer from '../PageContainer.tsx';

import { DayOfWeek, Schedules } from '@api/schedulesSchema.ts';
import { useScheduleStore } from './scheduleStore.tsx';
import DayTabs from './DayTabs.tsx';
import StartTimeSection from './StartTimeSection.tsx';
import EndTime from './EndTime.tsx';
import EnabledSwitch from './EnabledSwitch.tsx';
import SaveButton from './SaveButton.tsx';
import ApplyToOtherDaysAccordion from './ApplyToOtherDaysAccordion.tsx';
import TemperatureAdjustmentsAccordion from './TemperatureAdjustmentsAccordion.tsx';
import { useAppStore } from '@state/appStore.tsx';
import { postSchedules } from '@api/schedules';
import { useSettings } from '@api/settings';
import AlarmAccordion from './AlarmAccordion.tsx';


export default function SchedulePage() {
  const { setIsUpdating, side } = useAppStore();
  const { data: schedules, refetch } = useSchedules();
  const { selectedSchedule, setOriginalSchedules, selectedDays, selectedDay, reloadScheduleData } = useScheduleStore();
  const { data: settings } = useSettings();
  const displayCelsius = settings?.temperatureFormat === 'celsius';
  // TODO: Add changes lost notification using changesPresent when user tries to switch tab before saving

  useEffect(() => {
    if (!schedules) return;
    setOriginalSchedules(schedules);
    reloadScheduleData();
  }, [schedules]);

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
      })
  };

  return (
    <PageContainer
      sx={{
        width: '100%',
        maxWidth: { xs: '100%', sm: '800px' },
        mx: 'auto',
        pb: 15,
      }}
    >
      <SideControl/>
      <DayTabs/>
      <StartTimeSection displayCelsius={displayCelsius} />
      <EndTime/>
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', width: '100%', mb: 2 }}>
        <EnabledSwitch/>
        <SaveButton onSave={handleSave}/>
      </Box>
      {
        selectedSchedule?.power.enabled && (
          <>
            <TemperatureAdjustmentsAccordion displayCelsius={displayCelsius} />
            <AlarmAccordion />
            <ApplyToOtherDaysAccordion/>
          </>
        )
      }
    </PageContainer>
  );
}
