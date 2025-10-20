import { useSchedules } from '@api/schedules';
import type { DayOfWeek } from '@api/schedulesSchema';
import { useSettings } from '@api/settings';
import { useAppStore } from '@state/appStore.tsx';
import { LOWERCASE_DAYS } from '@components/schedules/days.ts';
import ScheduleOverview from '@components/schedules/ScheduleOverview.tsx';
import { useScheduleStore } from '@components/schedules/scheduleStore.tsx';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import moment from 'moment-timezone';
import { useEffect } from 'react';
import PageContainer from '@/components/shared/PageContainer.tsx';
import SideControl from '../../components/SideControl.tsx';

const getAdjustedDayOfWeek = (timezone: string | null): DayOfWeek => {
  // Get the current moment in the server's configured timezone
  const now = moment.tz(timezone || 'UTC');
  // Extract the hour of the day in 24-hour format
  const currentHour = now.hour();

  // Adjust for very early morning schedules (before 5 AM = still "yesterday's schedule")
  // This handles overnight schedules (e.g., 10 PM - 6 AM)
  if (currentHour < 5) {
    return now
      .subtract(1, 'day')
      .format('dddd')
      .toLocaleLowerCase() as DayOfWeek;
  } else {
    return now.format('dddd').toLocaleLowerCase() as DayOfWeek;
  }
};

function SchedulesIndexPage() {
  const { data: schedules, refetch } = useSchedules();
  const { data: settings } = useSettings();
  const { side } = useAppStore();
  const { setOriginalSchedules, selectDay } = useScheduleStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!settings) return;
    const day = getAdjustedDayOfWeek(settings.timeZone);
    selectDay(LOWERCASE_DAYS.indexOf(day));
  }, [settings, selectDay]);

  useEffect(() => {
    if (!schedules) return;
    setOriginalSchedules(schedules);
  }, [schedules, setOriginalSchedules]);

  const handleEditDay = (dayIndex: number) => {
    if (!schedules) return;

    const day = LOWERCASE_DAYS[dayIndex];
    const sideSchedules = schedules[side];

    // Find the schedule ID for this day
    const scheduleId = sideSchedules.assignments?.[day];

    if (scheduleId) {
      // Navigate to edit page with the schedule ID
      navigate({ to: '/schedules/$scheduleId', params: { scheduleId } });
    } else {
      // Fallback: if no schedule exists for this day, create new
      navigate({ to: '/schedules/new' });
    }
  };

  const handleEditGroup = (scheduleId: string) => {
    // Navigate to edit page with scheduleId
    navigate({ to: '/schedules/$scheduleId', params: { scheduleId } });
  };

  const handleCreateNew = () => {
    navigate({ to: '/schedules/new' });
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
          sm: '1200px',
        },
        mx: 'auto',
        mb: 15,
      }}
    >
      <SideControl title={'Schedules'} />

      <ScheduleOverview
        schedules={schedules}
        onEditDay={handleEditDay}
        onEditGroup={handleEditGroup}
        onCreateNew={handleCreateNew}
        onRefresh={refetch}
      />
    </PageContainer>
  );
}

export const Route = createFileRoute('/schedules/')({
  component: SchedulesIndexPage,
});
