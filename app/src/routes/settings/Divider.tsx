import { Divider as MuiDivider } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export default function Divider() {
  const theme = useTheme();

  return (
    <>
      <br />
      <MuiDivider
        sx={{
          border: `1px solid ${theme.palette.grey[800]}`,
          width: '100%',
        }}
      />
      <br />
    </>
  );
}
