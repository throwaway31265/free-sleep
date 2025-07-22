import { deleteSleepRecord, updateSleepRecord } from '@api/sleep.ts'; // Assuming you have this function
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import TransferWithinAStationIcon from '@mui/icons-material/TransferWithinAStation';
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import moment from 'moment-timezone';
import { useEffect, useState } from 'react';
import type { SleepRecord } from '../../../server/src/db/sleepRecordsSchema.ts';

// Helper to format time
const formatTime = (date: string) => moment(date).local().format('h:mm A');

// Helper to calculate sleep duration
const calculateSleepDuration = (start: string, end: string) => {
  const startTime = moment(start);
  const endTime = moment(end);
  const duration = moment.duration(endTime.diff(startTime));
  return `${Math.floor(duration.asHours())}h ${duration.minutes()}m`;
};

interface SleepRecordProps {
  sleepRecord?: SleepRecord;
  refetch?: () => void;
}

function formatDayLabel(dateString: string): string {
  const localTime = moment(dateString).local();
  return localTime.hour() < 6
    ? localTime.subtract(1, 'day').format('dddd')
    : localTime.format('dddd');
}

export default function SleepRecordCard({
  sleepRecord,
  refetch,
}: SleepRecordProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [enteredBedAt, setEnteredBedAt] = useState(
    moment(sleepRecord?.entered_bed_at),
  );
  const [leftBedAt, setLeftBedAt] = useState(moment(sleepRecord?.left_bed_at));

  useEffect(() => {
    if (!sleepRecord) return;
    setEnteredBedAt(moment(sleepRecord?.entered_bed_at));
    setLeftBedAt(moment(sleepRecord?.left_bed_at));
  }, [sleepRecord]);

  if (!sleepRecord) return null;

  const bedtime = formatTime(sleepRecord.entered_bed_at);
  const wakeTime = formatTime(sleepRecord.left_bed_at);
  const sleepDuration = calculateSleepDuration(
    sleepRecord.entered_bed_at,
    sleepRecord.left_bed_at,
  );

  const startDay = formatDayLabel(sleepRecord.entered_bed_at);
  const endDay = formatDayLabel(sleepRecord.left_bed_at);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this sleep record?')) {
      try {
        await deleteSleepRecord(sleepRecord.id);
        if (refetch) refetch();
      } catch (error) {
        console.error('Error deleting sleep record:', error);
        alert('Failed to delete the sleep record.');
      }
    }
  };

  const handleSave = async () => {
    try {
      await updateSleepRecord(sleepRecord.id, {
        entered_bed_at: enteredBedAt.toISOString(),
        left_bed_at: leftBedAt.toISOString(),
      });
      setEditOpen(false);
      if (refetch) refetch();
    } catch (error) {
      console.error('Error updating sleep record:', error);
      alert('Failed to update the sleep record.');
    }
  };

  return (
    <Card
      sx={{ p: 2, backgroundColor: 'background.paper', position: 'relative' }}
    >
      {/* Actions: Edit & Delete */}
      <Box
        sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 1 }}
      >
        <IconButton onClick={() => setEditOpen(true)} aria-label="edit">
          <EditIcon color="primary" />
        </IconButton>
        <IconButton onClick={handleDelete} aria-label="delete">
          <DeleteIcon color="error" />
        </IconButton>
      </Box>

      <Typography variant="h6" gutterBottom>
        Sleep Summary
      </Typography>

      <Box display="flex" flexDirection="column" gap={1}>
        {[
          { label: 'Period', value: `${startDay} - ${endDay}` },
          {
            label: 'Bedtime',
            value: bedtime,
            icon: <BedtimeIcon fontSize="small" />,
          },
          {
            label: 'Wake time',
            value: wakeTime,
            icon: <AccessAlarmIcon fontSize="small" />,
          },
          {
            label: 'Duration',
            value: sleepDuration,
            icon: <HourglassBottomIcon fontSize="small" />,
          },
          {
            label: 'Times exited bed',
            icon: <TransferWithinAStationIcon fontSize="small" />,
            value: `${sleepRecord.times_exited_bed} ${sleepRecord.times_exited_bed === 1 ? 'time' : 'times'}`,
          },
        ].map(({ label, value, icon }) => (
          <Box
            key={label}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box display="flex" alignItems="center" gap={2}>
              {icon && (
                <Box display="flex" alignItems="center">
                  {icon}
                </Box>
              )}
              <Typography sx={{ fontWeight: 'bold' }}>{label}</Typography>
            </Box>
            <Typography>{value}</Typography>
          </Box>
        ))}
      </Box>

      {/* Edit Modal */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth>
        <DialogTitle>Edit Sleep Record</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <DateTimePicker
              label="Entered Bed At"
              value={enteredBedAt}
              onChange={(newValue) => newValue && setEnteredBedAt(newValue)}
              ampm
            />
            <DateTimePicker
              label="Left Bed At"
              value={leftBedAt}
              onChange={(newValue) => newValue && setLeftBedAt(newValue)}
              ampm
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
