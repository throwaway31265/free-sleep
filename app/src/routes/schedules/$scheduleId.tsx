import { useSchedules } from '@api/schedules';
import type { DayOfWeek } from '@api/schedulesSchema';
import ScheduleEditView from '@components/schedules/ScheduleEditView.tsx';
import { useScheduleStore } from '@components/schedules/scheduleStore.tsx';
import { useAppStore } from '@state/appStore.tsx';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import PageContainer from '@/components/shared/PageContainer.tsx';
import SideControl from '../../components/SideControl.tsx';

function ScheduleEditPage() {
  const { scheduleId } = Route.useParams();
  const navigate = useNavigate();
  const { side } = useAppStore();
  const { data: schedules } = useSchedules();
  const { setOriginalSchedules, loadScheduleForEditing } = useScheduleStore();

  useEffect(() => {
    if (!schedules) return;
    setOriginalSchedules(schedules);
  }, [schedules, setOriginalSchedules]);

  useEffect(() => {
    if (!schedules || !scheduleId) return;

    const sideSchedules = schedules[side];

    // Check if schedule entity exists
    if (!sideSchedules.schedules?.[scheduleId]) {
      console.error(`Schedule ${scheduleId} not found`);
      // Redirect to overview if schedule doesn't exist
      navigate({ to: '/schedules', replace: true });
      return;
    }

    // Find which days are assigned to this schedule
    const assignments = sideSchedules.assignments;
    if (!assignments) {
      console.error('No assignments found');
      navigate({ to: '/schedules', replace: true });
      return;
    }

    const assignedDays: DayOfWeek[] = (
      Object.entries(assignments) as [DayOfWeek, string][]
    )
      .filter(([_, id]) => id === scheduleId)
      .map(([day]) => day);

    if (assignedDays.length === 0) {
      console.error(`Schedule ${scheduleId} has no assigned days`);
      navigate({ to: '/schedules', replace: true });
      return;
    }

    // Load the schedule for editing
    loadScheduleForEditing(scheduleId, assignedDays);
  }, [schedules, scheduleId, side, loadScheduleForEditing, navigate]);

  const handleBack = () => {
    navigate({ to: '/schedules' });
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
          sm: '800px',
        },
        mx: 'auto',
        mb: 15,
      }}
    >
      <SideControl title={'Schedules'} />

      <ScheduleEditView onBack={handleBack} />
    </PageContainer>
  );
}

export const Route = createFileRoute('/schedules/$scheduleId')({
  component: ScheduleEditPage,
});
