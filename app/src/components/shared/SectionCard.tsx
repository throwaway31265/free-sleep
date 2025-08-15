import type { SxProps } from '@mui/material';
import { Card, CardContent, CardHeader } from '@mui/material';
import type React from 'react';

type SectionCardProps = {
  title: string;
  subheader?: string;
  sx?: SxProps;
};

export default function SectionCard({
  title,
  subheader,
  sx,
  children,
}: React.PropsWithChildren<SectionCardProps>) {
  return (
    <Card
      sx={{
        width: '100%',
        height: 'fit-content',
        borderRadius: 3,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        border: '1px solid rgba(255,255,255,0.1)',
        ...sx
      }}
    >
      <CardHeader
        title={title}
        subheader={subheader}
        sx={{
          pb: 1,
          '& .MuiCardHeader-title': {
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'text.primary',
          },
          '& .MuiCardHeader-subheader': {
            fontSize: '0.875rem',
            color: 'text.secondary',
            mt: 0.5,
          }
        }}
      />
      <CardContent sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        pt: 1,
      }}>
        {children}
      </CardContent>
    </Card>
  );
}


