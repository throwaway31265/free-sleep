import { Box, Card, Typography, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { SleepRecord } from '../../../server/src/db/sleepRecordsSchema.ts';
import moment from 'moment-timezone';
import { deleteSleepRecord } from '@api/sleep.ts';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import TransferWithinAStationIcon from '@mui/icons-material/TransferWithinAStation';
// Helper to format the time
const formatTime = (utcDate: string) => moment.utc(utcDate).local().format('h:mm A');

import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';

// Helper to calculate sleep duration
const calculateSleepDuration = (start: string, end: string) => {
  const startTime = moment.utc(start);
  const endTime = moment.utc(end);
  const duration = moment.duration(endTime.diff(startTime));

  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();

  return `${hours}h ${minutes}m`;
};

interface SleepRecordProps {
  sleepRecord?: SleepRecord;
  refetch?: () => void;
  onEdit?: (record: SleepRecord) => void;
}

function formatDayLabel(dateString: string): string {
  const localTime = moment.utc(dateString).local();
  if (localTime.hour() < 6) {
    return localTime.subtract(1, 'day').format('dddd');
  } else {
    return localTime.format('dddd');
  }
}

export default function SleepRecordCard({ sleepRecord, refetch }: SleepRecordProps) {
  if (!sleepRecord) return null;

  const bedtime = formatTime(sleepRecord.entered_bed_at);
  const wakeTime = formatTime(sleepRecord.left_bed_at);
  const sleepDuration = calculateSleepDuration(
    sleepRecord.entered_bed_at,
    sleepRecord.left_bed_at
  );

  const startDay = formatDayLabel(sleepRecord.entered_bed_at);
  const endDay = formatDayLabel(sleepRecord.left_bed_at);
  const handleDelete = async () => {
    const confirmDelete = window.confirm('Are you sure you want to delete this sleep record?');
    if (confirmDelete && sleepRecord.id) {
      try {
        await deleteSleepRecord(sleepRecord.id);
        if (refetch) refetch(); // Trigger parent refresh if provided
      } catch (error) {
        console.error('Error deleting sleep record:', error);
        alert('Failed to delete the sleep record.');
      }
    }
  };

  return (
    <Card sx={ { p: 2, backgroundColor: 'background.paper', position: 'relative' } }>
      <Box sx={ { position: 'absolute', top: 8, right: 8, display: 'flex', gap: 1 } }>
        <IconButton onClick={ handleDelete } aria-label="delete">
          <DeleteIcon color="error"/>
        </IconButton>
      </Box>

      <Typography variant="h6" gutterBottom>
        Sleep Summary
      </Typography>
      <Box display="flex" flexDirection="column" gap={ 1 }>
        { [
          { label: 'Period', value: `${startDay} - ${endDay}` },
          { label: 'Bedtime', value: bedtime, icon: <BedtimeIcon fontSize="small"/> },
          { label: 'Wake time', value: wakeTime, icon: <AccessAlarmIcon fontSize="small"/> },
          { label: 'Duration', value: sleepDuration, icon: <HourglassBottomIcon fontSize="small"/> },
          {
            label: 'Times exited bed',
            icon: <TransferWithinAStationIcon fontSize="small"/>,
            value: `${sleepRecord.times_exited_bed} ${
              sleepRecord.times_exited_bed === 1 ? 'time' : 'times'
            }`,
          },
        ].map(({ label, value, icon }) => (
          <Box
            key={ label }
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={ {
              typography: 'body1',
            } }
          >
            { /* Wrap Icon and Label in a Flex Container */ }
            <Box display="flex" alignItems="center" gap={ 2 }>
              {
                icon && (
                  <Box display="flex" alignItems="center">
                    { icon }
                  </Box>
                )
              }
              <Typography sx={ { fontWeight: 'bold', display: 'flex', alignItems: 'center' } }>
                { label }
              </Typography>
            </Box>

            <Typography sx={ { display: 'flex', alignItems: 'center' } }>
              { value }
            </Typography>
          </Box>
        )) }
      </Box>


    </Card>
  );
}
