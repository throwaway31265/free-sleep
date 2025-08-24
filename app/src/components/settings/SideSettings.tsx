import type { Settings } from '@api/settingsSchema.ts';
import { Box, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import Switch from '@mui/material/Switch';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { type Side, useAppStore } from '@state/appStore.tsx';
import moment, { type Moment } from 'moment';
import { useEffect, useState } from 'react';
import type { DeepPartial } from 'ts-essentials';
import Alert from '@mui/material/Alert';

type AwayModeSwitchProps = {
  side: Side;
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

export default function SideSettings({
  side,
  settings,
  updateSettings,
}: AwayModeSwitchProps) {
  const { isUpdating } = useAppStore();
  const title = side.charAt(0).toUpperCase() + side.slice(1);

  // Local state to manage the text field value
  const [sideName, setSideName] = useState(settings?.[side]?.name || '');
  // Update local state when settings change (e.g., from API)
  useEffect(() => {
    setSideName(settings?.[side]?.name || side);
  }, [settings, side]);

  const handleBlur = () => {
    if (sideName.trim().length === 0) return;
    if (sideName.trim() !== settings?.[side]?.name) {
      updateSettings({ [side]: { name: sideName.trim() } });
    }
  };

  const formatForDatePicker = (iso?: string | null): Moment | null => {
    if (!iso) return null;
    try {
      return moment(iso);
    } catch {
      return null;
    }
  };

  // Local state for the DateTimePicker to avoid posting on every change
  const [awayReturnLocal, setAwayReturnLocal] = useState<Moment | null>(
    formatForDatePicker(settings?.[side]?.awayReturn),
  );
  const [awayStartLocal, setAwayStartLocal] = useState<Moment | null>(
    formatForDatePicker(settings?.[side]?.awayStart),
  );
  // Keep local picker state in sync when settings change externally
  useEffect(() => {
    setAwayReturnLocal(formatForDatePicker(settings?.[side]?.awayReturn));
    setAwayStartLocal(formatForDatePicker(settings?.[side]?.awayStart));
  }, [settings, side]);

  const commitAwayReturn = (value: Moment | null) => {
    const currentIso = settings?.[side]?.awayReturn || null;
    const nextIso = value ? value.toISOString() : null;
    if (currentIso === nextIso) return;
    updateSettings({ [side]: { awayReturn: nextIso } });
  };

  const commitAwayStart = (value: Moment | null) => {
    const currentIso = settings?.[side]?.awayStart || null;
    const nextIso = value ? value.toISOString() : null;
    if (currentIso === nextIso) return;
    updateSettings({ [side]: { awayStart: nextIso } });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" color="primary">
        {title} Side
      </Typography>
      {/* Indicator: Away scheduled but not yet active */}
      {!settings?.[side]?.awayMode && awayStartLocal && awayStartLocal.isAfter(moment()) && (
        <Alert severity="info">
          Away is scheduled to start at {awayStartLocal.format('YYYY-MM-DD HH:mm')}
        </Alert>
      )}
      <TextField
        label="Custom Name"
        placeholder={`Enter name for ${side} side`}
        value={sideName}
        onChange={(e) => setSideName(e.target.value)}
        onBlur={handleBlur}
        disabled={isUpdating}
        inputProps={{ maxLength: 20 }}
        fullWidth
        helperText="Give this side a personalized name (e.g., 'Sarah's Side')"
      />
      <Grid container alignItems="center" justifyContent="space-between">
        <Box>
          <Typography>Away Mode</Typography>
          <Typography variant="caption" color="text.secondary">
            Disable temperature control when away
          </Typography>
        </Box>
        <Switch
          disabled={isUpdating}
          checked={settings?.[side]?.awayMode || false}
          onChange={(__event, checked) =>
            updateSettings({ [side]: { awayMode: checked } })
          }
        />
      </Grid>
      <Grid container alignItems="center" justifyContent="space-between">
        <Box>
          <Typography>Away Start</Typography>
          <Typography variant="caption" color="text.secondary">
            Optional. If empty and Away Mode is on, it starts immediately.
          </Typography>
        </Box>
        <DateTimePicker
          label="Away Start Time"
          value={awayStartLocal}
          onChange={(value) => setAwayStartLocal(value as Moment | null)}
          onAccept={(value) => {
            const v = (value as Moment) ?? null;
            if (awayReturnLocal && v && awayReturnLocal.isBefore(v)) return;
            commitAwayStart(v);
          }}
          onClose={() => {
            const v = awayStartLocal;
            if (awayReturnLocal && v && awayReturnLocal.isBefore(v)) return;
            commitAwayStart(v);
          }}
          disabled={isUpdating}
          sx={{ minWidth: 260 }}
          slotProps={{
            textField: (() => {
              const invalid = !!(awayStartLocal && awayReturnLocal && awayReturnLocal.isBefore(awayStartLocal));
              return invalid
                ? { error: true, helperText: 'Start must be before Return' }
                : {};
            })(),
          }}
        />
      </Grid>

      <Grid container alignItems="center" justifyContent="space-between">
        <Box>
          <Typography>Away Return</Typography>
          <Typography variant="caption" color="text.secondary">
            When to automatically resume schedules
          </Typography>
        </Box>
        <DateTimePicker
          label="Away Return Time"
          value={awayReturnLocal}
          onChange={(value) => setAwayReturnLocal(value as Moment | null)}
          onAccept={(value) => {
            const v = (value as Moment) ?? null;
            // Validate: return must be after start (if start set)
            if (awayStartLocal && v && v.isBefore(awayStartLocal)) return;
            commitAwayReturn(v);
          }}
          onClose={() => {
            const v = awayReturnLocal;
            if (awayStartLocal && v && v.isBefore(awayStartLocal)) return;
            commitAwayReturn(v);
          }}
          disabled={isUpdating}
          sx={{ minWidth: 260 }}
          slotProps={{
            textField: (() => {
              const invalid = !!(awayStartLocal && awayReturnLocal && awayReturnLocal.isBefore(awayStartLocal));
              return invalid
                ? { error: true, helperText: 'Return must be after Start' }
                : {};
            })(),
          }}
        />
      </Grid>
    </Box>
  );
}
