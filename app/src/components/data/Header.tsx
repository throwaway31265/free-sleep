import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import { Grid, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type HeaderProps = {
  title: string;
  icon: ReactNode;
};

export default function Header({ title, icon }: HeaderProps) {
  return (
    <Grid container alignItems="center" sx={{ width: '100%', mb: 2 }}>
      {/* Back Icon - Fixed width on left */}
      <Grid size="auto" display="flex" alignItems="center">
        <NavigateBeforeIcon
          onClick={() => window.history.back()}
          sx={{ cursor: 'pointer', fontSize: 28, mr: 2 }}
        />
      </Grid>
      {/* Title - Takes remaining space and centers itself */}
      <Grid size="grow" display="flex" justifyContent="center">
        <Typography variant="h6" display="flex" alignItems="center" gap={1}>
          {icon}
          {title}
        </Typography>
      </Grid>
      {/* Invisible spacer to balance the back button for true centering */}
      <Grid size="auto" sx={{ width: '40px' }} />
    </Grid>
  );
}
