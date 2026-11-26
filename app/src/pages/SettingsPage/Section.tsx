import { PropsWithChildren, ReactNode, useId } from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import { alpha } from '@mui/material/styles';

type SectionProps = PropsWithChildren<{ title?: string; icon?: ReactNode }>;

// Grouped card used for every settings block. Same card on phone and desktop so sections stay easy to scan.
export default function Section({ title, icon, children }: SectionProps) {
  const titleId = useId();

  return (
    <Card
      component="section"
      aria-labelledby={ title ? titleId : undefined }
      sx={ { width: '100%', minWidth: 0, overflowWrap: 'anywhere' } }
    >
      { title && (
        <Box sx={ { display: 'flex', alignItems: 'center', gap: 1.25, px: { xs: 2, sm: 2.5 }, pt: 2, pb: 0.5 } }>
          { icon && (
            <Box
              sx={ theme => ({
                display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: '10px', flexShrink: 0,
                color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.12),
                '& .MuiSvgIcon-root': { fontSize: 18 },
              }) }
            >
              { icon }
            </Box>
          ) }
          <Typography id={ titleId } component="h2" variant="h6">{ title }</Typography>
        </Box>
      ) }
      <CardContent sx={ { px: { xs: 2, sm: 2.5 }, pt: 2, pb: 2.5, '&:last-child': { pb: 2.5 } } }>{ children }</CardContent>
    </Card>
  );
}
