import { Alert, AlertTitle, Button, Box, Typography, IconButton } from '@mui/material';
import { Warning, Error, Info, Close } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getLeakAlerts, dismissLeakAlert, type LeakAlert } from '../api/waterLevel';

function getSeverityColor(severity: LeakAlert['severity']): 'error' | 'warning' | 'info' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    default:
      return 'info';
  }
}

function getSeverityIcon(severity: LeakAlert['severity']) {
  switch (severity) {
    case 'critical':
    case 'high':
      return <Error />;
    case 'medium':
      return <Warning />;
    case 'low':
    default:
      return <Info />;
  }
}

function getAlertTitle(alertType: LeakAlert['alertType'], severity: LeakAlert['severity']): string {
  switch (alertType) {
    case 'fast_leak':
      return severity === 'critical' ? 'Critical Water Leak Detected!' : 'Water Leak Detected';
    case 'slow_leak':
      return 'Slow Water Level Drop Detected';
    case 'sensor_anomaly':
      return 'Water Sensor Anomaly';
    default:
      return 'Water Level Alert';
  }
}

function getAlertDescription(alert: LeakAlert): string {
  const { alertType, severity, rateOfChange, hoursTracked, rawLevelStart, rawLevelEnd } = alert;

  const levelChange = rawLevelEnd - rawLevelStart;
  const timeSpan = hoursTracked > 1 ? `${hoursTracked.toFixed(1)} hours` : `${(hoursTracked * 60).toFixed(0)} minutes`;

  switch (alertType) {
    case 'fast_leak':
      return `Water level dropped by ${Math.abs(levelChange).toFixed(3)} units over ${timeSpan} (${Math.abs(rateOfChange).toFixed(4)} units/hour). ${
        severity === 'critical'
          ? 'This indicates a major leak requiring immediate attention!'
          : 'Please check for leaks in your system.'
      }`;

    case 'slow_leak':
      return `Gradual water level decrease detected over ${timeSpan}. Rate: ${Math.abs(rateOfChange).toFixed(4)} units/hour. This could indicate a small leak or normal evaporation.`;

    case 'sensor_anomaly':
      return `Unusual readings detected in water level sensor over ${timeSpan}. Please check sensor connections and calibration.`;

    default:
      return `Water level changed by ${levelChange.toFixed(3)} units over ${timeSpan}.`;
  }
}

interface LeakAlertItemProps {
  alert: LeakAlert;
  onDismiss: (timestamp: number) => void;
  isLoading?: boolean;
}

function LeakAlertItem({ alert, onDismiss, isLoading }: LeakAlertItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const severity = getSeverityColor(alert.severity);
  const icon = getSeverityIcon(alert.severity);
  const title = getAlertTitle(alert.alertType, alert.severity);
  const description = getAlertDescription(alert);

  const alertTime = new Date(alert.timestamp * 1000).toLocaleString();

  return (
    <Alert
      severity={severity}
      icon={icon}
      sx={{ mb: 1 }}
      action={
        <IconButton
          size="small"
          onClick={() => onDismiss(alert.timestamp)}
          disabled={isLoading}
          aria-label="dismiss alert"
        >
          <Close fontSize="small" />
        </IconButton>
      }
    >
      <AlertTitle>{title}</AlertTitle>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {description}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Detected: {alertTime}
        </Typography>

        <Button
          size="small"
          variant="text"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Less Details' : 'More Details'}
        </Button>
      </Box>

      {isExpanded && (
        <Box sx={{ mt: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="caption" component="div">
            <strong>Alert Type:</strong> {alert.alertType.replace('_', ' ')}<br />
            <strong>Severity:</strong> {alert.severity}<br />
            <strong>Time Period:</strong> {alert.hoursTracked.toFixed(1)} hours<br />
            <strong>Rate of Change:</strong> {alert.rateOfChange.toFixed(4)} units/hour<br />
            <strong>Level Start:</strong> {alert.rawLevelStart.toFixed(3)}<br />
            <strong>Level End:</strong> {alert.rawLevelEnd.toFixed(3)}<br />
            <strong>Total Change:</strong> {(alert.rawLevelEnd - alert.rawLevelStart).toFixed(3)} units
          </Typography>
        </Box>
      )}
    </Alert>
  );
}

export default function LeakAlertNotification() {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['leak-alerts'],
    queryFn: getLeakAlerts,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3,
  });

  const dismissMutation = useMutation({
    mutationFn: dismissLeakAlert,
    onSuccess: () => {
      // Refetch alerts after dismissing
      queryClient.invalidateQueries({ queryKey: ['leak-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['water-level-summary'] });
    },
    onError: (error) => {
      console.error('Failed to dismiss leak alert:', error);
      // Could add a toast notification here
    },
  });

  if (isLoading || alerts.length === 0) {
    return null;
  }

  // Sort alerts by severity and timestamp (most severe and recent first)
  const sortedAlerts = [...alerts].sort((a, b) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];

    if (severityDiff !== 0) {
      return severityDiff;
    }

    return b.timestamp - a.timestamp;
  });

  return (
    <Box sx={{ mb: 2 }}>
      {sortedAlerts.map((alert) => (
        <LeakAlertItem
          key={alert.timestamp}
          alert={alert}
          onDismiss={(timestamp) => dismissMutation.mutate(timestamp)}
          isLoading={dismissMutation.isPending}
        />
      ))}
    </Box>
  );
}
