import { postSchedules, useSchedules } from '@api/schedules';
import { useSettings } from '@api/settings';
import { ArrowBack } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  TextField,
  Typography,
} from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import AlarmAccordion from './AlarmAccordion.tsx';
import ElevationAdjustmentsAccordion from './ElevationAdjustmentsAccordion.tsx';
import EnabledSwitch from './EnabledSwitch.tsx';
import PowerOffTime from './PowerOffTime.tsx';
import SaveButton from './SaveButton.tsx';
import StartTimeSection from './StartTimeSection.tsx';
import { useScheduleStore } from './scheduleStore.tsx';
import TemperatureAdjustmentsAccordion from './TemperatureAdjustmentsAccordion.tsx';

type BasicScheduleEditProps = {
  onBack: () => void;
};

export default function BasicScheduleEdit({ onBack }: BasicScheduleEditProps) {
  const { setIsUpdating, side, setError, clearError } = useAppStore();
  const { refetch } = useSchedules();
  const {
    selectedSchedule,
    currentScheduleId,
    isCreatingNew,
    scheduleName,
    setScheduleName,
  } = useScheduleStore();
  const { data: settings } = useSettings();
  const displayCelsius = settings?.temperatureFormat === 'celsius';

  const handleSave = async () => {
    setIsUpdating(true);
    clearError();

    // Use entity-based operations
    const operation = isCreatingNew ? 'create' : 'updateGroup';
    const payload = {
      operation,
      side,
      scheduleId: currentScheduleId,
      schedule: selectedSchedule,
      name: scheduleName || undefined,
      // In basic mode, days parameter is not required (handled by backend)
    };

    await postSchedules(payload)
      .then(() => {
        return new Promise((resolve) => setTimeout(resolve, 1_000));
      })
      .then(() => refetch())
      .then(() => {
        // Navigate back to overview after successful save
        onBack();
      })
      .catch((error) => {
        console.error(error);

        // Extract meaningful error message for user
        let errorMessage = 'Failed to save schedule';

        if (error.response?.status === 400) {
          if (error.response?.data?.details) {
            errorMessage = `Invalid schedule: ${error.response.data.details}`;
          } else {
            errorMessage = error.response?.data?.error || errorMessage;
          }
        }

        setError(errorMessage);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };

  return (
    <Box sx={{ maxWidth: '800px', mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 3,
        }}
      >
        <Button
          onClick={onBack}
          startIcon={<ArrowBack />}
          sx={{
            color: 'rgba(255, 255, 255, 0.8)',
            textTransform: 'none',
            fontSize: '14px',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
        >
          Back
        </Button>
        <Typography
          variant="h5"
          sx={{
            color: '#fff',
            fontWeight: '600',
            fontSize: { xs: '20px', sm: '24px' },
          }}
        >
          {isCreatingNew ? 'Create New Schedule' : 'Edit Schedule'}
        </Typography>
      </Box>

      {/* Schedule Name */}
      <Card
        sx={{
          mb: 3,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
        }}
      >
        <CardContent>
          <Typography
            variant="subtitle2"
            sx={{
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              mb: 1,
            }}
          >
            Schedule Name
          </Typography>
          <TextField
            fullWidth
            placeholder="e.g., Shift, Days Off, Vacation..."
            value={scheduleName}
            onChange={(e) => setScheduleName(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#2196F3',
                },
              },
              '& .MuiInputBase-input::placeholder': {
                color: 'rgba(255, 255, 255, 0.4)',
                opacity: 1,
              },
            }}
          />
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '11px',
              display: 'block',
              mt: 0.5,
            }}
          >
            Give your schedule a descriptive name to easily identify it
          </Typography>
        </CardContent>
      </Card>

      {/* Schedule Enabled Switch */}
      <EnabledSwitch />

      <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

      {/* Bedtime Section */}
      <StartTimeSection displayCelsius={displayCelsius} />

      <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

      {/* Wake Time Section */}
      <PowerOffTime />

      <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

      {/* Alarm Settings */}
      <AlarmAccordion />

      <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

      {/* Temperature Adjustments */}
      <TemperatureAdjustmentsAccordion displayCelsius={displayCelsius} />

      <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

      {/* Elevation Adjustments */}
      <ElevationAdjustmentsAccordion />

      {/* Save Button */}
      <Box sx={{ mt: 4, pb: 4 }}>
        <SaveButton onSave={handleSave} />
      </Box>
    </Box>
  );
}
