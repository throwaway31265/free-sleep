import { useState, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import { TextField, IconButton, InputAdornment, Typography, Box, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';


export default function Donate() {
  const bitcoinAddress = 'bc1qjapkufh65gs68v2mkvrzq2ney3vnvv87jdxxg6';
  const [copySuccess, setCopySuccess] = useState(false);
  const textFieldRef = useRef(null);
  const theme = useTheme();
  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(bitcoinAddress);
      } else {
        // Fallback for browsers without clipboard API support
        const textField = textFieldRef.current;
        // @ts-ignore
        textField?.select();
        document.execCommand('copy');
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      console.error('Failed to copy address', err);
    }
  };

  return (
    <Box
      sx={ {
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexDirection: 'column',
        [theme.breakpoints.up('sm')]: {
          width: '100%',
          maxWidth: '350px',
        },
        [theme.breakpoints.down('sm')]: {
          width: '100%',
        },
      } }
    >
      <Typography variant="h6" sx={ { display: 'flex', alignItems: 'center' } }>
        Support the Project <CurrencyBitcoinIcon fontSize="large"/>
      </Typography>
      <Typography variant="body2" color="textSecondary">
        Like the app? Don't like paying $200/year elsewhere? Buy me a drink instead!
      </Typography>
      <TextField
        inputRef={ textFieldRef }
        variant="outlined"
        fullWidth
        onSelect={ handleCopy }
        value={ bitcoinAddress }
        sx={ {
          cursor: 'pointer',
          '& .MuiInputBase-input': {
            cursor: 'pointer',
            fontSize: '12px', // Adjust the font size here
          }
        } }
        inputProps={ { readOnly: true } }
        InputProps={ {
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title="Copy">
                <IconButton onClick={ handleCopy }>
                  <ContentCopyIcon/>
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        } }
      />
      <Typography variant="body2" color="textSecondary">
        { copySuccess ? 'Copied!' : 'Copy and send to the bitcoin address above.' }
      </Typography>
    </Box>
  );
}
