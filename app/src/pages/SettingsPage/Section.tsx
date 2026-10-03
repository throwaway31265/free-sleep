import { PropsWithChildren, ReactNode, useId } from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

type SectionProps = PropsWithChildren<{ title?: string; icon?: ReactNode }>;

export default function Section({ title, icon, children }: SectionProps) {
  const titleId = useId();

  return (
    <Card component="section" aria-labelledby={ title ? titleId : undefined } sx={ { width: '100%', minWidth: 0, overflowWrap: 'anywhere' } }>
      { title && (
        <Box sx={ { display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' } }>
          { icon && <Box sx={ { display: 'flex', color: 'text.secondary', '& .MuiSvgIcon-root': { fontSize: 18 } } }>{ icon }</Box> }
          <Typography id={ titleId } component="h2" variant="h6" sx={ { fontSize: 14 } }>{ title }</Typography>
        </Box>
      ) }
      <CardContent sx={ { p: 2.5, '&:last-child': { pb: 2.5 } } }>{ children }</CardContent>
    </Card>
  );
}
