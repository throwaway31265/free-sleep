import { Box, Typography } from '@mui/material';
import { ReactNode } from 'react';

type PageHeaderProps = { title: string; subtitle?: string; children?: ReactNode };

export default function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <Box sx={ { width: '100%', mb: 0.5, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' } }>
      <Box sx={ { minWidth: 0 } }>
        <Typography variant="h2" component="h1" sx={ { fontSize: { xs: 30, md: 34 }, lineHeight: 1.15 } }>{ title }</Typography>
        { subtitle && <Typography variant="body2" sx={ { color: 'text.secondary', mt: 0.5 } }>{ subtitle }</Typography> }
      </Box>
      { children }
    </Box>
  );
}
