import { ReactNode } from 'react';
import { Grid, Typography } from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import { useNavigate } from 'react-router-dom';

type HeaderProps = {
  title: string;
  icon: ReactNode;
};

export default function Header({ title, icon }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <Grid container alignItems="center">
      {/* Back Icon - Left Aligned & Vertically Centered */}
      <Grid item xs={2} display="flex" alignItems="center">
        <NavigateBeforeIcon
          onClick={() => navigate(-1)}
          sx={{ cursor: 'pointer', fontSize: 28 }}
        />
      </Grid>
      {/* Title - Centered */}
      <Grid item xs={8} display="flex" justifyContent="center">
        <Typography variant="h6" display="flex" alignItems="center" gap={1}>
          {icon}
          {title}
        </Typography>
      </Grid>
    </Grid>
  );
}
