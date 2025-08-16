import { useDeviceStatus } from '@/api/deviceStatus';
import { Alert, Container, type ContainerProps, type SxProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type React from 'react';

type PageContainerProps = {
  containerProps?: ContainerProps;
  sx?: SxProps;
};

export default function PageContainer({
  children,
  sx,
  containerProps,
}: React.PropsWithChildren<PageContainerProps>) {
  const theme = useTheme();
  const { data: deviceStatus, isLoading } = useDeviceStatus();

  if (!isLoading && !deviceStatus) {
    return (
      <Container
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '90vh',
          padding: 4,
        }}
      >
        <Alert
          severity="error"
          sx={{
            width: '100%',
            maxWidth: '600px',
            fontSize: '1.2rem',
            padding: 3,
          }}
        >
          Error loading device status. Could not reach the device.
        </Alert>
      </Container>
    );
  }

  return (
    <Container
      {...containerProps}
      id="PageContainer"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifySelf: 'center',
        flexGrow: 1,
        alignItems: 'center',
        gap: 2,
        margin: 0,
        justifyContent: 'center',
        // Mobile (xs)
        [theme.breakpoints.down('sm')]: {
          width: '100%',
          padding: 1,
          paddingBottom: 12, // Add bottom padding for mobile navigation (80px + extra spacing)
        },
        // Small tablets (sm)
        [theme.breakpoints.between('sm', 'md')]: {
          width: '90%',
          padding: 0,
          paddingTop: 4,
          paddingBottom: 12, // Add bottom padding for mobile navigation on tablets
          maxWidth: '700px',
        },
        // Medium tablets and small desktops (md)
        [theme.breakpoints.between('md', 'lg')]: {
          width: '85%',
          padding: 0,
          paddingTop: 6,
          paddingBottom: 12,
          maxWidth: '900px',
        },
        // Large desktops (lg)
        [theme.breakpoints.between('lg', 'xl')]: {
          width: '80%',
          padding: 0,
          paddingTop: 6,
          paddingBottom: 12,
          maxWidth: '1200px',
        },
        // Extra large desktops (xl)
        [theme.breakpoints.up('xl')]: {
          width: '75%',
          padding: 0,
          paddingTop: 8,
          paddingBottom: 12,
          maxWidth: '1400px',
        },
        ...sx,
      }}
    >
      {children}
    </Container>
  );
}
