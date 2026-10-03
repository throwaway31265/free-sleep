import { PropsWithChildren } from 'react';
import { Box } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export default function SettingsHint({ children }: PropsWithChildren) {
  return (
    <Box sx={ { display: 'flex', gap: 1, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', color: 'text.secondary' } }>
      <InfoOutlinedIcon sx={ { fontSize: 16, flexShrink: 0, mt: 0.25 } }/>
      <Box sx={ { fontSize: 12, lineHeight: 1.65, minWidth: 0 } }>{ children }</Box>
    </Box>
  );
}
