import { postSchedules, useSchedules } from '@api/schedules';
import type { DayOfWeek } from '@api/schedulesSchema';
import { useSettings } from '@api/settings';
import { ArrowBack, CheckCircle, Schedule, Warning } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Paper,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import _ from 'lodash';
import { useEffect } from 'react';
import AlarmAccordion from './AlarmAccordion.tsx';
import ElevationAdjustmentsAccordion from './ElevationAdjustmentsAccordion.tsx';
import EnabledSwitch from './EnabledSwitch.tsx';
import MultiDaySelector from './MultiDaySelector.tsx';
import PowerOffTime from './PowerOffTime.tsx';
import SaveButton from './SaveButton.tsx';
import StartTimeSection from './StartTimeSection.tsx';
import { formatGroupedDays } from './scheduleGrouping.ts';
import { useScheduleStore } from './scheduleStore.tsx';
import TemperatureAdjustmentsAccordion from './TemperatureAdjustmentsAccordion.tsx';

type ScheduleEditViewProps = {
  onBack: () => void;
};

export default function ScheduleEditView({ onBack }: ScheduleEditViewProps) {
  const { setIsUpdating, side, setError, clearError } = useAppStore();
  const { refetch } = useSchedules();
  const {
    selectedSchedule,
    selectedDays,
    reloadScheduleData,
    isValid,
    currentScheduleId,
    isCreatingNew,
  } = useScheduleStore();
  const { data: settings } = useSettings();
  const displayCelsius = settings?.temperatureFormat === 'celsius';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    reloadScheduleData();
  }, [side]);

  const handleSave = async () => {
    setIsUpdating(true);
    clearError(); // Clear any previous errors

    const daysList: DayOfWeek[] = _.uniq(
      _.keys(_.pickBy(selectedDays, (value) => value)) as DayOfWeek[],
    );

    // Validate that at least one day is selected
    if (daysList.length === 0) {
      setError(
        'Please select at least one day for this schedule. Use the day selector above to choose which days this schedule should apply to.',
      );
      setIsUpdating(false);
      return;
    }

    // Use entity-based operations
    const operation = isCreatingNew ? 'create' : 'updateGroup';
    const payload = {
      operation,
      side,
      scheduleId: currentScheduleId,
      days: daysList,
      schedule: selectedSchedule,
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
            errorMessage =
              'Invalid schedule settings. Please check the configuration and try again.';
          }
        } else if (error.response?.status === 500) {
          errorMessage = 'Server error. Please try again in a moment.';
        } else if (error.code === 'NETWORK_ERROR' || !error.response) {
          errorMessage =
            'Network error. Please check your connection and try again.';
        }

        setError(errorMessage);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };

  // Check if we're editing multiple days
  const selectedDaysList = Object.entries(selectedDays)
    .filter(([_, isSelected]) => isSelected)
    .map(([day, _]) => day as DayOfWeek);
  const allSelectedDays = selectedDaysList;
  const isGroupEdit = allSelectedDays.length > 1;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2.5, sm: 3, md: 4 },
        bgcolor: '#000',
        color: '#fff',
      }}
    >
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          p: { xs: 2, sm: 3, md: 4 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: { xs: 2, sm: 0 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={onBack}
              sx={{
                color: '#fff',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                px: { xs: 2, sm: 3 },
                py: { xs: 1.5, sm: 2 },
                fontSize: { xs: '14px', sm: '16px' },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              {isMobile ? 'Back' : 'Back to Overview'}
            </Button>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Schedule sx={{ color: '#fff', fontSize: 20 }} />
              </Box>
              <Typography
                variant="h5"
                sx={{
                  color: '#fff',
                  fontWeight: '600',
                  fontSize: { xs: '1.25rem', sm: '1.5rem' },
                }}
              >
                {isCreatingNew
                  ? 'Create Schedule'
                  : isGroupEdit
                    ? 'Edit Group Schedule'
                    : 'Edit Schedule'}
              </Typography>
            </Box>
          </Box>

          {isGroupEdit && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: { xs: '12px', sm: '14px' },
                }}
              >
                Editing:
              </Typography>
              <Chip
                label={formatGroupedDays(allSelectedDays)}
                size="small"
                sx={{
                  backgroundColor: 'rgba(33, 150, 243, 0.15)',
                  color: '#2196F3',
                  border: '1px solid rgba(33, 150, 243, 0.3)',
                  fontSize: { xs: '11px', sm: '12px' },
                }}
              />
            </Box>
          )}
        </Box>

        {/* Status indicator */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          {isValid() ? (
            <>
              <CheckCircle sx={{ fontSize: 16, color: '#4CAF50' }} />
              <Typography
                variant="caption"
                sx={{ color: '#4CAF50', fontSize: { xs: '11px', sm: '12px' } }}
              >
                Schedule is valid and ready to save
              </Typography>
            </>
          ) : (
            <>
              <Warning sx={{ fontSize: 16, color: '#FF9800' }} />
              <Typography
                variant="caption"
                sx={{ color: '#FF9800', fontSize: { xs: '11px', sm: '12px' } }}
              >
                Please complete required fields
              </Typography>
            </>
          )}
        </Box>
      </Paper>

      {/* Main Configuration */}
      <Card
        sx={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 } }}>
          <Typography
            variant="h6"
            sx={{
              color: '#fff',
              fontWeight: '600',
              mb: 3,
              fontSize: { xs: '1.1rem', sm: '1.25rem' },
            }}
          >
            Basic Settings
          </Typography>

          <MultiDaySelector />

          <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

          <StartTimeSection displayCelsius={displayCelsius} />

          <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

          <PowerOffTime />
        </CardContent>
      </Card>
      {/* Actions */}
      <Paper
        elevation={0}
        sx={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          p: { xs: 3, sm: 4 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: { xs: 3, sm: 2 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <EnabledSwitch />
            {selectedSchedule?.power.enabled && (
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: { xs: '12px', sm: '14px' },
                }}
              >
                Schedule will run when enabled
              </Typography>
            )}
          </Box>

          <SaveButton onSave={handleSave} />
        </Box>
      </Paper>
      {selectedSchedule?.power.enabled && (
        <Card
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 } }}>
            <Typography
              variant="h6"
              sx={{
                color: '#fff',
                fontWeight: '600',
                mb: 3,
                fontSize: { xs: '1.1rem', sm: '1.25rem' },
              }}
            >
              Advanced Settings
            </Typography>

            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                mb: 3,
                fontSize: { xs: '13px', sm: '14px' },
              }}
            >
              Optional features to customize your sleep experience
            </Typography>

            <TemperatureAdjustmentsAccordion displayCelsius={displayCelsius} />
            <Box sx={{ my: 2 }} />
            <ElevationAdjustmentsAccordion />
            <Box sx={{ my: 2 }} />
            <AlarmAccordion />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
