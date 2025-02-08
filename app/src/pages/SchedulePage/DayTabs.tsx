import { Tab, Tabs } from '@mui/material';
import { useScheduleStore } from './scheduleStore.tsx';
import { useAppStore } from '@state/appStore.tsx';
import { LOWERCASE_DAYS } from './days.ts';

export default function DayTabs() {
  const { selectDay, selectedDayIndex } = useScheduleStore();
  const { isUpdating } = useAppStore();
  return (
    <Tabs
      value={ selectedDayIndex || 0 }
      onChange={ (_, index) => selectDay(index) }
      variant="scrollable"
      scrollButtons="auto"
      aria-label="Days of the week"
      sx={ {
        width: '100%',
        maxWidth: '100%',
        overflowX: 'auto',
      } }
    >
      {
        LOWERCASE_DAYS.map((day, index) => (
          <Tab key={ index } label={ day } disabled={ isUpdating }/>
        ))
      }
    </Tabs>
  );
}
