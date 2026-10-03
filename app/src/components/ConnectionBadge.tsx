import { Box, Chip } from '@mui/material';
import { useDeviceStatus } from '@api/deviceStatus.ts';

export default function ConnectionBadge() {
  const { data, isError } = useDeviceStatus();
  const connected = Boolean(data) && !isError;
  const label = isError ? 'Pod unavailable' : connected ? 'Pod connected' : 'Connecting';

  return (
    <Chip
      size="small"
      color={ connected ? 'success' : 'default' }
      label={ label }
      icon={ <Box component="span" sx={ { width: 6, height: 6, borderRadius: '50%', bgcolor: 'currentColor' } }/> }
      sx={ { '& .MuiChip-icon': { ml: 1.25, mr: 0, color: 'inherit' } } }
    />
  );
}
