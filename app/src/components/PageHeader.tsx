import { Box, Typography } from '@mui/material';
import { ReactNode } from 'react';

type PageHeaderProps = { title: string; children?: ReactNode };

export default function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <Box sx={ { width: '100%', mb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' } }>
      <Typography variant="h2" component="h1" sx={ { fontSize: { xs: 27, md: 30 } } }>{ title }</Typography>
      { children }
    </Box>
  );
}
