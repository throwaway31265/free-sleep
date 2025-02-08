import Select from '@mui/material/Select';
import { MenuItem, Box, Typography } from '@mui/material';
import { Side, useAppStore } from '@state/appStore.tsx';
import { useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSettings } from '@api/settings.ts';


export default function SideControl() {
  const { side, setSide } = useAppStore();
  const { data: settings } = useSettings();
  const theme = useTheme();
  const onSelect = (side: Side) => {
    setSide(side);
  };

  return (
    <Box sx={ { marginRight: 'auto' } }>
      <Select
        value={ side }
        // @ts-ignore
        onChange={ (e) => onSelect(e.target.value) }
        label="Side"
        variant="standard"
        IconComponent={ ExpandMoreIcon }
        disableUnderline={ true }
        sx={ {
          color: theme.palette.text.secondary,
          // borderBottom: '0px solid red',
          boxShadow: 'none',

          '.MuiOutlinedInput-notchedOutline': { border: 0 },
          '.MuiInput': { border: 0 },
          '.MuiInput-underline': { border: 0 },
        } }
      >
        <MenuItem value="left" sx={ { display: side === 'left' ? 'none' : 'block' } }>
          {
            side === 'left' && (
              <Typography variant="h6">
                { settings?.[side].name }
              </Typography>
            )
          }
          Left side
        </MenuItem>
        )
        <MenuItem value="right" sx={ { display: side === 'right' ? 'none' : 'block' } }>
          {
            side === 'right' && (
              <Typography variant="h6">
                { settings?.[side].name }
              </Typography>
            )
          }
          Right side
        </MenuItem>

      </Select>
    </Box>
  );
}
