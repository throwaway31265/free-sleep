import { Box, Button, Typography, Alert } from '@mui/material';
import { useState } from 'react';
import { useAppStore } from '@state/appStore.tsx';
import { postSchedules } from '@api/schedules.ts';
import type { Side } from '@api/schedulesSchema.ts';

interface ScheduleModeSelectorProps {
  currentMode: 'day-specific' | 'basic';
  onModeChanged: () => void;
}

export default function ScheduleModeSelector({
  currentMode,
  onModeChanged,
}: ScheduleModeSelectorProps) {
  const { side, setIsUpdating } = useAppStore();
  const [switching, setSwitching] = useState(false);

  const handleModeSwitch = async (newMode: 'day-specific' | 'basic') => {
    if (newMode === currentMode || switching) return;

    setSwitching(true);
    setIsUpdating(true);

    try {
      await postSchedules({
        operation: 'setMode',
        side: side as Side,
        mode: newMode,
      });
      onModeChanged();
    } catch (error) {
      console.error('Failed to switch mode:', error);
    } finally {
      setSwitching(false);
      setIsUpdating(false);
    }
  };

  const isBasicMode = currentMode === 'basic';

  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          p: 2,
          borderRadius: '16px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="subtitle2"
            sx={{
              color: '#fff',
              fontSize: '16px',
              fontWeight: '600',
              mb: 1,
            }}
          >
            Schedule Mode
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              display: 'block',
              mb: 2,
            }}
          >
            {isBasicMode
              ? 'Basic mode: One schedule applies to all days. Perfect for shift workers.'
              : 'Day-specific mode: Different schedules for different days.'}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant={!isBasicMode ? 'contained' : 'outlined'}
              onClick={() => handleModeSwitch('day-specific')}
              disabled={switching}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: '600',
                px: 2,
                ...(isBasicMode
                  ? {
                      color: 'rgba(255, 255, 255, 0.7)',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      '&:hover': {
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      },
                    }
                  : {
                      backgroundColor: '#4CAF50',
                      color: '#fff',
                      '&:hover': {
                        backgroundColor: '#45a049',
                      },
                    }),
              }}
            >
              Day-Specific
            </Button>
            <Button
              variant={isBasicMode ? 'contained' : 'outlined'}
              onClick={() => handleModeSwitch('basic')}
              disabled={switching}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: '600',
                px: 2,
                ...(!isBasicMode
                  ? {
                      color: 'rgba(255, 255, 255, 0.7)',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      '&:hover': {
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      },
                    }
                  : {
                      backgroundColor: '#2196F3',
                      color: '#fff',
                      '&:hover': {
                        backgroundColor: '#1976D2',
                      },
                    }),
              }}
            >
              Basic
            </Button>
          </Box>
        </Box>
      </Box>

      {isBasicMode && (
        <Alert
          severity="info"
          sx={{
            mt: 2,
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            border: '1px solid rgba(33, 150, 243, 0.3)',
            '& .MuiAlert-icon': {
              color: '#2196F3',
            },
            '& .MuiAlert-message': {
              color: 'rgba(255, 255, 255, 0.9)',
            },
          }}
        >
          In basic mode, create multiple named schedules (like "Shift", "Days
          Off") and easily switch between them. The active schedule applies to
          all 7 days.
        </Alert>
      )}
    </Box>
  );
}
