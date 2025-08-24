import type { Settings } from '@api/settingsSchema.ts';
import { Box, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import Switch from '@mui/material/Switch';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { type Side, useAppStore } from '@state/appStore.tsx';
import moment, { type Moment } from 'moment';
import { useEffect, useState } from 'react';
import type { DeepPartial } from 'ts-essentials';

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
  // Keep local picker state in sync when settings change externally
  useEffect(() => {
    setAwayReturnLocal(formatForDatePicker(settings?.[side]?.awayReturn));
  }, [settings, side]);

  const commitAwayReturn = (value: Moment | null) => {
    const currentIso = settings?.[side]?.awayReturn || null;
    const nextIso = value ? value.toISOString() : null;
    if (currentIso === nextIso) return;
    updateSettings({ [side]: { awayReturn: nextIso } });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" color="primary">
        {title} Side
      </Typography>
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
      {settings?.[side]?.awayMode && (
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
            onAccept={(value) => commitAwayReturn((value as Moment) ?? null)}
            onClose={() => commitAwayReturn(awayReturnLocal)}
            disabled={isUpdating}
            sx={{ minWidth: 260 }}
          />
        </Grid>
      )}
    </Box>
  );
}
