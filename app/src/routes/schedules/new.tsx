import ScheduleEditView from '@components/schedules/ScheduleEditView.tsx';
import { useScheduleStore } from '@components/schedules/scheduleStore.tsx';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import PageContainer from '@/components/shared/PageContainer.tsx';
import SideControl from '../../components/SideControl.tsx';

function ScheduleNewPage() {
  const navigate = useNavigate();
  const { createBlankSchedule } = useScheduleStore();

  useEffect(() => {
    // Create a blank schedule when component mounts
    createBlankSchedule();
  }, [createBlankSchedule]);

  const handleBack = () => {
    navigate({ to: '/schedules' });
  };

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

export const Route = createFileRoute('/schedules/new')({
  component: ScheduleNewPage,
});
