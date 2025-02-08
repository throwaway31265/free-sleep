import Grid from '@mui/material/Grid2';
import Switch from '@mui/material/Switch';
import { Box, TextField, Typography } from '@mui/material';
import { DeepPartial } from 'ts-essentials';
import { useEffect, useState } from 'react';

import { Settings } from '@api/settingsSchema.ts';
import { Side, useAppStore } from '@state/appStore.tsx';

type AwayModeSwitchProps = {
  side: Side;
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
}

export default function SideSettings({ side, settings, updateSettings }: AwayModeSwitchProps) {
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

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'center' } }>
      <Typography variant="h5">{ title } Side</Typography>
      <TextField
        label="Side Name"
        placeholder="Enter side name"
        value={ sideName }
        onChange={ (e) => setSideName(e.target.value) }
        onBlur={ handleBlur }
        disabled={ isUpdating }
        sx={ { mt: 2 } }
        inputProps={ { maxLength: 20 } }
        fullWidth
      />
      <Grid container spacing={ 0 }>
        <Typography alignContent="center">Away mode</Typography>
        <Switch
          disabled={ isUpdating }
          checked={ settings?.[side].awayMode || false }
          onChange={ (event) => updateSettings({ [side]: { awayMode: event.target.checked } }) }
        />
      </Grid>
    </Box>
  );
}
