import { PropsWithChildren, ReactElement } from 'react';
import { Box, FormControlLabel } from '@mui/material';

type SettingToggleProps = PropsWithChildren<{ label: string; control: ReactElement }>;

export default function SettingToggle({ label, control, children }: SettingToggleProps) {
  return (
    <Box sx={ { minWidth: 0 } }>
      <FormControlLabel
        label={ label }
        labelPlacement="start"
        control={ control }
        sx={ {
          m: 0, width: '100%', justifyContent: 'space-between', gap: 2,
          '& .MuiFormControlLabel-label': { fontSize: 13, fontWeight: 500, color: 'text.primary' },
          '& .MuiSwitch-root': { flexShrink: 0, mr: -1 },
        } }
      />
      { children && <Box sx={ { mt: 0.5, color: 'text.secondary', fontSize: 12, lineHeight: 1.65 } }>{ children }</Box> }
    </Box>
  );
}
