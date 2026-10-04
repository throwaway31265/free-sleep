import { Box, Chip, Divider, Typography } from '@mui/material';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { Version } from '@api/deviceStatusSchema';
import VersionStatus from '@components/VersionStatus.tsx';
import WifiStrength from './WifiStrength.tsx';
import RebootButton from './RebootButton.tsx';

export default function DeviceInfo() {
  const { data: deviceStatus, isLoading } = useDeviceStatus();
  if (isLoading || !deviceStatus) return null;
  const hideCover = deviceStatus.coverVersion === Version.NotFound;
  const hideHub = deviceStatus.hubVersion === Version.NotFound;

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
        <Box sx={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 } }>
          <Typography variant="body2" sx={ { color: 'text.secondary' } }>Device</Typography>
          <Box sx={ { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 0.75 } }>
            { !hideCover && <Chip label={ `${deviceStatus.coverVersion} Cover` } size="small"/> }
            { !hideHub && <Chip label={ `${deviceStatus.hubVersion} Hub` } size="small"/> }
          </Box>
        </Box>
        <Box sx={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 } }>
          <Typography variant="body2" sx={ { color: 'text.secondary' } }>Free Sleep Build</Typography>
          <Box sx={ { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 0.75 } }>
            <Chip label={ `v${deviceStatus?.freeSleep?.version}` } size="small"/>
            <Chip label={ deviceStatus?.freeSleep?.branch } size="small"/>
          </Box>
        </Box>
        <Box sx={ { display: 'flex', '& .MuiChip-root': { mb: 0 } } }><WifiStrength/></Box>
      </Box>
      <Box
        sx={ {
          '& .MuiAlert-root': { alignItems: 'flex-start', width: '100%' },
          '& .MuiAlert-message': { minWidth: 0, width: '100%' },
          '& .MuiAlertTitle-root': { fontSize: 13, fontWeight: 500 },
          '& .MuiAlert-root .MuiTypography-root': { fontSize: 12 },
          '& .MuiAlert-root .MuiButton-root': { mt: 1 },
        } }
      >
        <VersionStatus/>
      </Box>
      <Divider/>
      <RebootButton/>
    </Box>
  );
}
