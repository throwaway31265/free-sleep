import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import { Grid, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type HeaderProps = {
  title: string;
  icon: ReactNode;
};

export default function Header({ title, icon }: HeaderProps) {
  return (
    <Grid container alignItems="center">
      {/* Back Icon - Left Aligned & Vertically Centered */}
      <Grid size={2} display="flex" alignItems="center">
        <NavigateBeforeIcon
          onClick={() => window.history.back()}
          sx={{ cursor: 'pointer', fontSize: 28 }}
        />
      </Grid>
      {/* Title - Centered */}
      <Grid size={8} display="flex" justifyContent="center">
        <Typography variant="h6" display="flex" alignItems="center" gap={1}>
          {icon}
          {title}
        </Typography>
      </Grid>
    </Grid>
  );
}
