import { Button } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';

type SaveButtonProps = {
  onSave: () => void;
}

export default function SaveButton({ onSave }: SaveButtonProps) {
  const { isUpdating } = useAppStore();
  const { changesPresent } = useScheduleStore();
  if (!changesPresent) return null;

  return (
    <Button variant="contained" onClick={ onSave } disabled={ isUpdating }>
      Save
    </Button>
  );
}
