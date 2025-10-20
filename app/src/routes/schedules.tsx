import { useSchedules } from '@api/schedules';
import type { DayOfWeek } from '@api/schedulesSchema';
import { LOWERCASE_DAYS } from '@components/schedules/days.ts';
import ScheduleEditView from '@components/schedules/ScheduleEditView.tsx';
import ScheduleOverview from '@components/schedules/ScheduleOverview.tsx';
import { useScheduleStore } from '@components/schedules/scheduleStore.tsx';
import { createFileRoute } from '@tanstack/react-router';
import moment from 'moment-timezone';
import { useEffect, useState } from 'react';
import PageContainer from '@/components/shared/PageContainer.tsx';
import SideControl from '../components/SideControl.tsx';

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

function SchedulePage() {
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

  const handleEditGroup = (scheduleId: string, dayIndices: number[]) => {
    // For group editing, load the schedule entity
    const { loadScheduleForEditing } = useScheduleStore.getState();
    const groupDays = dayIndices.map(
      (index) => LOWERCASE_DAYS[index] as DayOfWeek,
    );

    loadScheduleForEditing(scheduleId, groupDays);
    setViewMode('edit');
  };

  const handleCreateNew = () => {
    // Create a truly blank schedule
    const { createBlankSchedule } = useScheduleStore.getState();
    createBlankSchedule();
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

export const Route = createFileRoute('/schedules')({
  component: SchedulePage,
});
