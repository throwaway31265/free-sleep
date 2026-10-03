import { useState, useRef } from 'react';
import { Link, TextField, IconButton, InputAdornment, Typography, Box, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import Section from './Section.tsx';
import paypalIcon from './paypal.png';

export default function Donate() {
  const bitcoinAddress = 'bc1qjapkufh65gs68v2mkvrzq2ney3vnvv87jdxxg6';
  const [copySuccess, setCopySuccess] = useState(false);
  const textFieldRef = useRef<HTMLInputElement>(null);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(bitcoinAddress);
      } else {
        // Fallback for browsers without clipboard API support
        const textField = textFieldRef.current;
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
    <Section title="Support the Project" icon={ <AttachMoneyIcon/> }>
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>
        <Typography variant="body2" color="text.secondary" sx={ { fontSize: 12 } }>
          Like the app? Don't like paying $200/year elsewhere? Buy me a drink instead!
        </Typography>
        <Box
          sx={ {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1,
            py: 1, borderBottom: '1px solid', borderColor: 'divider',
          } }
        >
          <Link href="https://paypal.me/realfreesleep" target="_blank" sx={ { display: 'flex', alignItems: 'center', minHeight: 44 } }>
            <img src={ paypalIcon } alt="Donate via PayPal" width={ 135 } height={ 36 }/>
          </Link>
          <Link href="https://paypal.me/realfreesleep" target="_blank" sx={ { fontSize: 12, py: 1.5 } }>
            Donate via PayPal
          </Link>
        </Box>
        <Box>
          <Typography variant="body2" fontWeight={ 500 } sx={ { display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 } }>
            Bitcoin <CurrencyBitcoinIcon sx={ { fontSize: 18 } }/>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={ { fontSize: 12, mb: 1.5 } }>
            { copySuccess ? 'Copied!' : 'Copy and send to the bitcoin address below' }
          </Typography>
          <TextField
            inputRef={ textFieldRef }
            variant="outlined"
            fullWidth
            onSelect={ handleCopy }
            value={ bitcoinAddress }
            size="small"
            sx={ {
              cursor: 'pointer',
              '& .MuiInputBase-input': { cursor: 'pointer', fontSize: '12px', fontFamily: 'monospace', py: 1.5 },
            } }
            inputProps={ { readOnly: true } }
            InputProps={ {
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Copy">
                    <IconButton onClick={ handleCopy }>
                      <ContentCopyIcon sx={ { fontSize: 18 } }/>
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            } }
          />
        </Box>
      </Box>
    </Section>
  );
}
