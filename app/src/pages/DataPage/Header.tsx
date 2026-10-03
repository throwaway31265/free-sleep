import { ReactNode } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

type HeaderProps = { title: string; icon: ReactNode };

export default function Header({ title, icon }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <Box sx={ { display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', mb: 2 } }>
      <IconButton aria-label="Go back" onClick={ () => navigate(-1) } sx={ { border: '1px solid', borderColor: 'divider' } }>
        <ArrowBackIcon sx={ { fontSize: 19 } }/>
      </IconButton>
      <Typography variant="h3" component="h1" sx={ { display: 'flex', alignItems: 'center', gap: 1 } }>
        { icon }
        { title }
      </Typography>
    </Box>
  );
}
