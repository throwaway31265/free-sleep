import {
  Button,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';

type SaveButtonProps = {
  onSave: () => void;
};

export default function SaveButton({ onSave }: SaveButtonProps) {
  const { isUpdating } = useAppStore();
  const { changesPresent, isValid, selectedDays } = useScheduleStore();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
      size={isMobile ? 'large' : 'medium'}
      startIcon={
        isUpdating ? (
          <CircularProgress size={16} sx={{ color: 'inherit' }} />
        ) : null
      }
      sx={{
        backgroundColor: valid
          ? 'rgba(76, 175, 80, 0.2)'
          : 'rgba(255, 255, 255, 0.1)',
        borderColor: valid
          ? 'rgba(76, 175, 80, 0.5)'
          : 'rgba(255, 255, 255, 0.2)',
        color: valid ? '#4CAF50' : 'rgba(255, 255, 255, 0.5)',
        borderRadius: '16px',
        px: { xs: 3, sm: 4 },
        py: { xs: 1.5, sm: 2 },
        fontSize: { xs: '14px', sm: '16px' },
        fontWeight: '600',
        minWidth: { xs: '120px', sm: '140px' },
        border: '1px solid',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          backgroundColor: valid
            ? 'rgba(76, 175, 80, 0.3)'
            : 'rgba(255, 255, 255, 0.1)',
          borderColor: valid
            ? 'rgba(76, 175, 80, 0.7)'
            : 'rgba(255, 255, 255, 0.3)',
          transform: valid ? 'translateY(-1px)' : 'none',
        },
        '&:disabled': {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          color: 'rgba(255, 255, 255, 0.3)',
          transform: 'none',
        },
      }}
    >
      {isUpdating
        ? 'Saving...'
        : `Save${dayCount > 1 ? ` (${dayCount} days)` : ''}`}
    </Button>
  );
}
