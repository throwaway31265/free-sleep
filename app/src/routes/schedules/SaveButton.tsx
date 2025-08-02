import { Button } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';

type SaveButtonProps = {
  onSave: () => void;
};

export default function SaveButton({ onSave }: SaveButtonProps) {
  const { isUpdating } = useAppStore();
  const { changesPresent, isValid, selectedDays } = useScheduleStore();
  if (!changesPresent) return null;

  const valid = isValid();

  const selectedDaysList = Object.entries(selectedDays)
    .filter(([_, isSelected]) => isSelected)
    .map(([day, _]) => day);

  // Only count actually selected days, consistent with MultiDaySelector
  const allSelectedDays = selectedDaysList;
  const dayCount = allSelectedDays.length;

  return (
    <Button
      variant="contained"
      onClick={onSave}
      disabled={isUpdating || !valid}
    >
      Save {dayCount > 1 ? `(${dayCount} days)` : ''}
    </Button>
  );
}
