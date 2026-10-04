import { Dispatch, SetStateAction, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import moment from 'moment-timezone';
import { postSettings, useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';


export interface AlarmDisabledDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  scheduledAlarmTimeHhMm: string;
  alarmDisabled: boolean;
}

export default function AlarmDisabledDialog({
  open,
  setOpen,
  scheduledAlarmTimeHhMm,
  alarmDisabled,
}: AlarmDisabledDialogProps) {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [isSaving, setIsSaving] = useState(false);
  const { data: settings, refetch } = useSettings();
  const side = useAppStore(state => state.side);

  const handleSave = () => {
    if (!settings) return null;
    const now = moment.tz(settings.timeZone);
    const noonToday = now.clone().hour(12).minute(0).second(0).millisecond(0);
    const targetDay = now.isSameOrAfter(noonToday) ? now.clone().add(1, 'day') : now;


    const [hour, minute] = scheduledAlarmTimeHhMm.split(':').map(Number);
    const expiresAt = moment.tz(
      {
        year: targetDay.year(),
        month: targetDay.month(),
        date: targetDay.date(),
        hour,
        minute,
        second: 0,
        millisecond: 0,
      },
      settings.timeZone
    ).add(2, 'minutes').format();
    setIsSaving(true);
    const disabled = !alarmDisabled;
    postSettings({
      [side]: {
        scheduleOverrides: {
          alarm: {
            disabled: disabled,
            timeOverride: '',
            expiresAt: disabled ? expiresAt : '',
          }
        }
      }
    })
      .then(() => {
        setOpen(false);
        return refetch();
      })
      .catch(error => {
        console.error(error);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleCancel = () => {
    setOpen(false);
  };

  return (
    <Dialog
      open={ open }
      fullScreen={ isSmallScreen }
      slotProps={ {
        paper: {
          sx: isSmallScreen
            ? {
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              maxWidth: '85vw',
              maxHeight: '35vh',
              borderRadius: '10px',
              margin: 0,
              p: 4,
            }
            : {
              p: 4,
              width: '50%',
              height: '150px',
            },
        }
      } }
    >
      <Typography variant="h5" sx={ { textAlign: 'center' } }>
        { alarmDisabled ? 'Enable' : 'Disable' } alarm for tonight?
      </Typography>

      <DialogActions sx={ { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } }>

        { isSaving ? (
          <CircularProgress size={ 10 }/>
        ) : (
          <Box sx={ { display: 'flex', gap: 1 } }>
            <Button variant="contained" color="error" size="small" onClick={ handleCancel }>
              Cancel
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={ handleSave }
            >
              Yes
            </Button>
          </Box>
        ) }
      </DialogActions>
    </Dialog>
  );
}
