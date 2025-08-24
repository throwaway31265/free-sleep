import type { Settings } from '@api/settingsSchema.ts';
import { Box, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import Switch from '@mui/material/Switch';
import { type Side, useAppStore } from '@state/appStore.tsx';
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

  const formatForInput = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const min = pad(d.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    } catch {
      return '';
    }
  };

  const handleAwayReturnChange = (value: string) => {
    // value from datetime-local is in local time; convert to ISO
    if (!value) {
      updateSettings({ [side]: { awayReturn: null } });
      return;
    }
    const iso = new Date(value).toISOString();
    updateSettings({ [side]: { awayReturn: iso } });
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
          onChange={(event) =>
            updateSettings({ [side]: { awayMode: event.target.checked } })
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
          <TextField
            type="datetime-local"
            value={formatForInput(settings?.[side]?.awayReturn)}
            onChange={(e) => handleAwayReturnChange(e.target.value)}
            disabled={isUpdating}
            sx={{ minWidth: 220 }}
          />
        </Grid>
      )}
    </Box>
  );
}
