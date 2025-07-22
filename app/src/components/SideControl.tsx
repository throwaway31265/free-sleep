import { useSettings } from '@api/settings.ts';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SwitchLeftIcon from '@mui/icons-material/SwitchLeft';
import SwitchRightIcon from '@mui/icons-material/SwitchRight';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  SwipeableDrawer,
  Typography,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import { styled, useTheme } from '@mui/material/styles';
import { type Side, useAppStore } from '@state/appStore.tsx';
import { useState } from 'react';

type SideControlProps = {
  title?: string;
};

const Puller = styled('div')(({ theme }) => ({
  width: 30,
  height: 6,
  backgroundColor: grey[300],
  borderRadius: 3,
  position: 'absolute',
  top: 8,
  left: 'calc(50% - 15px)',
  ...theme.applyStyles('dark', {
    backgroundColor: grey[900],
  }),
}));

export default function SideControl({ title }: SideControlProps) {
  const { side, setSide } = useAppStore();
  const { data: settings } = useSettings();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const onSelect = (side: Side) => {
    setSide(side);
    setOpen(false);
  };

  return (
    <Box sx={{ marginRight: 'auto' }}>
      <Box sx={{ cursor: 'pointer' }} onClick={() => setOpen(true)}>
        <Typography variant="h6">
          {title}{' '}
          <ExpandMoreIcon
            style={{ display: 'inline-block', verticalAlign: 'middle' }}
          />
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {settings?.[side]?.name}
        </Typography>
      </Box>

      <SwipeableDrawer
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        anchor={'bottom'}
        variant="temporary"
        open={open}
        elevation={2}
        sx={{
          '.MuiDrawer-paper': {
            backgroundColor: theme.palette.background.default,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingTop: 2,
          },
        }}
      >
        <Puller />
        <List aria-label="Select side">
          <ListItemButton onClick={() => onSelect('left')}>
            <ListItemIcon>
              <SwitchRightIcon />
            </ListItemIcon>
            <ListItemText secondary={`Left`} primary={settings?.left?.name} />
          </ListItemButton>
          <ListItemButton onClick={() => onSelect('right')}>
            <ListItemIcon>
              <SwitchLeftIcon />
            </ListItemIcon>
            <ListItemText secondary={`Right`} primary={settings?.right?.name} />
          </ListItemButton>
        </List>
      </SwipeableDrawer>
    </Box>
  );
}
