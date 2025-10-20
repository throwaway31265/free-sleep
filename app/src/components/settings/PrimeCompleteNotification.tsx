import type { DeviceStatus } from '@api/deviceStatusSchema.ts';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Close from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { format } from 'date-fns';

type PrimeCompleteNotificationProps = {
  deviceStatus?: DeviceStatus;
  onDismiss: () => void;
  isLoading?: boolean;
};

export default function PrimeCompleteNotification({
  deviceStatus,
  onDismiss,
  isLoading,
}: PrimeCompleteNotificationProps) {
  if (!deviceStatus?.primeCompletedNotification) {
    return null;
  }

  const { timestamp } = deviceStatus.primeCompletedNotification;
  const formattedTime = format(new Date(timestamp), 'MMM d, yyyy h:mm a');

  return (
    <Alert
      severity="success"
      icon={<CheckCircle />}
      sx={{ mb: 1 }}
      action={
        <IconButton
          size="small"
          onClick={onDismiss}
          disabled={isLoading}
          aria-label="dismiss notification"
        >
          <Close fontSize="small" />
        </IconButton>
      }
    >
      <AlertTitle>Priming Completed Successfully</AlertTitle>
      <Typography variant="body2">
        System priming was completed at {formattedTime}
      </Typography>
    </Alert>
  );
}
