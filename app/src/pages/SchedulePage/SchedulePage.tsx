import { useSchedules } from '@api/schedules';
import type { DayOfWeek } from '@api/schedulesSchema.ts';
import moment from 'moment-timezone';
import { useEffect, useState } from 'react';
import SideControl from '../../components/SideControl.tsx';
import PageContainer from '../PageContainer.tsx';
import { LOWERCASE_DAYS } from './days.ts';
import ScheduleEditView from './ScheduleEditView.tsx';
import ScheduleOverview from './ScheduleOverview.tsx';
import { useScheduleStore } from './scheduleStore.tsx';

const getAdjustedDayOfWeek = (): DayOfWeek => {
  // Get the current moment in the specified timezone
  const now = moment();
  // Extract the hour of the day in 24-hour format
  const currentHour = now.hour();

  // Determine if it's before noon (12:00 PM)
  if (currentHour < 12) {
    return now
      .subtract(1, 'day')
      .format('dddd')
      .toLocaleLowerCase() as DayOfWeek;
  } else {
    return now.format('dddd').toLocaleLowerCase() as DayOfWeek;
  }
};

export default function SchedulePage() {
  const { data: schedules, refetch } = useSchedules();
  const { setOriginalSchedules, selectDay, setSelectedDays } =
    useScheduleStore();
  const [viewMode, setViewMode] = useState<'overview' | 'edit'>('overview');

  useEffect(() => {
    const day = getAdjustedDayOfWeek();
    selectDay(LOWERCASE_DAYS.indexOf(day));
  }, []);

  useEffect(() => {
    if (!schedules) return;
    setOriginalSchedules(schedules);
  }, [schedules]);

  const handleEditDay = (dayIndex: number) => {
    selectDay(dayIndex);
    setSelectedDays([]); // Clear any previous group selections
    setViewMode('edit');
  };

  const handleEditGroup = (dayIndices: number[]) => {
    // For group editing, select the first day and pre-select all days in the group
    selectDay(dayIndices[0]);

    // Convert day indices to day names and pre-select ALL days in the group
    const groupDays = dayIndices.map(
      (index) => LOWERCASE_DAYS[index] as DayOfWeek,
    );
    const otherDays = groupDays.filter((_, index) => index !== 0); // Exclude first day to avoid duplication in the store

    setViewMode('edit');

    // Set selected days AFTER switching to edit mode to prevent them from being cleared
    setTimeout(() => {
      setSelectedDays(otherDays);
    }, 0);
  };

  const handleCreateNew = () => {
    const day = getAdjustedDayOfWeek();
    selectDay(LOWERCASE_DAYS.indexOf(day));
    setSelectedDays([]); // Clear any previous group selections
    setViewMode('edit');
  };

  const handleBackToOverview = () => {
    setViewMode('overview');
  };

  if (!schedules) {
    return null;
  }

  return (
    <PageContainer
      sx={{
        width: '100%',
        maxWidth: {
          xs: '100%',
          sm: viewMode === 'overview' ? '1200px' : '800px',
        },
        mx: 'auto',
        mb: 15,
      }}
    >
      <SideControl title={'Schedules'} />

      {viewMode === 'overview' ? (
        <ScheduleOverview
          schedules={schedules}
          onEditDay={handleEditDay}
          onEditGroup={handleEditGroup}
          onCreateNew={handleCreateNew}
          onRefresh={refetch}
        />
      ) : (
        <ScheduleEditView onBack={handleBackToOverview} />
      )}
    </PageContainer>
  );
}
