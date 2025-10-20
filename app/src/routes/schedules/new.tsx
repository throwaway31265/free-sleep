import { useSchedules } from '@api/schedules';
import ScheduleEditView from '@components/schedules/ScheduleEditView.tsx';
import BasicScheduleEdit from '@components/schedules/BasicScheduleEdit.tsx';
import { useScheduleStore } from '@components/schedules/scheduleStore.tsx';
import { useAppStore } from '@state/appStore.tsx';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import PageContainer from '@/components/shared/PageContainer.tsx';
import SideControl from '../../components/SideControl.tsx';

function ScheduleNewPage() {
  const navigate = useNavigate();
  const { side } = useAppStore();
  const { data: schedules } = useSchedules();
  const { createBlankSchedule, setOriginalSchedules } = useScheduleStore();

  useEffect(() => {
    // Set original schedules if available
    if (schedules) {
      setOriginalSchedules(schedules);
    }
    // Create a blank schedule when component mounts
    createBlankSchedule();
  }, [createBlankSchedule, schedules, setOriginalSchedules]);

  const handleBack = () => {
    navigate({ to: '/schedules' });
  };

  if (!schedules) {
    return null;
  }

  const sideSchedules = schedules[side];
  const isBasicMode = sideSchedules.mode === 'basic';

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

      {isBasicMode ? (
        <BasicScheduleEdit onBack={handleBack} />
      ) : (
        <ScheduleEditView onBack={handleBack} />
      )}
    </PageContainer>
  );
}

export const Route = createFileRoute('/schedules/new')({
  component: ScheduleNewPage,
});
