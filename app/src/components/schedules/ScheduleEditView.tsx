import { postSchedules, useSchedules } from '@api/schedules';
import type { DayOfWeek, Schedules } from '@api/schedulesSchema';
import { useSettings } from '@api/settings';
import { ArrowBack } from '@mui/icons-material';
import { Box, Button, Chip, Typography } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import _ from 'lodash';
import { useEffect } from 'react';
import type { DeepPartial } from 'ts-essentials';
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
  const { selectedSchedule, selectedDays, reloadScheduleData } =
    useScheduleStore();
  const { data: settings } = useSettings();
  const displayCelsius = settings?.temperatureFormat === 'celsius';

  useEffect(() => {
    reloadScheduleData();
  }, [side]);

  const handleSave = async () => {
    setIsUpdating(true);
    clearError(); // Clear any previous errors

    const daysList: DayOfWeek[] = _.uniq(
      _.keys(_.pickBy(selectedDays, (value) => value)) as DayOfWeek[],
    );

    const payload: DeepPartial<Schedules> = { [side]: {} };
    daysList.forEach((day) => {
      if (payload[side] && selectedSchedule) {
        payload[side][day] = selectedSchedule;
      }
    });

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
            errorMessage = 'Invalid schedule settings. Please check the configuration and try again.';
          }
        } else if (error.response?.status === 500) {
          errorMessage = 'Server error. Please try again in a moment.';
        } else if (error.code === 'NETWORK_ERROR' || !error.response) {
          errorMessage = 'Network error. Please check your connection and try again.';
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
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Button startIcon={<ArrowBack />} onClick={onBack} sx={{ mr: 2 }}>
          Back to Overview
        </Button>

        {isGroupEdit && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Editing:
            </Typography>
            <Chip
              label={formatGroupedDays(allSelectedDays)}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
        )}
      </Box>

      <MultiDaySelector />
      <StartTimeSection displayCelsius={displayCelsius} />
      <PowerOffTime />
      <Box
        sx={{
          mt: 2,
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          mb: 2,
        }}
      >
        <EnabledSwitch />
        <SaveButton onSave={handleSave} />
      </Box>
      {selectedSchedule?.power.enabled && (
        <>
          <TemperatureAdjustmentsAccordion displayCelsius={displayCelsius} />
          <ElevationAdjustmentsAccordion />
          <AlarmAccordion />
        </>
      )}
    </Box>
  );
}
