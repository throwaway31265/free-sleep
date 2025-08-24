import { postSettings, useSettings } from '@api/settings';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { Box, FormControlLabel, Switch, Tooltip } from '@mui/material';
import { useAppStore } from '@state/appStore';

export default function LinkToggle() {
  const { data: settings, refetch } = useSettings();
  const { isUpdating, setIsUpdating, clearError, setError } = useAppStore();
  const linked = settings?.linkBothSides || false;

  const onToggle = (checked: boolean) => {
    setIsUpdating(true);
    clearError();
    postSettings({ linkBothSides: checked })
      .then(() => new Promise((r) => setTimeout(r, 500)))
      .then(() => refetch())
      .catch((error) => {
        console.error(error);
        setError('Failed to update link setting');
      })
      .finally(() => setIsUpdating(false));
  };

  return (
    <Box sx={{ alignSelf: 'flex-end' }}>
      <Tooltip
        title={
          linked
            ? 'Lock enabled: manual controls apply to both sides'
            : 'Enable to apply manual controls to both sides'
        }
      >
        <FormControlLabel
          control={
            <Switch
              checked={linked}
              onChange={(_, c) => onToggle(c)}
              disabled={isUpdating}
              icon={<LockOpenIcon fontSize="small" />}
              checkedIcon={<LockIcon fontSize="small" />}
            />
          }
          label="Lock both sides"
        />
      </Tooltip>
    </Box>
  );
}

