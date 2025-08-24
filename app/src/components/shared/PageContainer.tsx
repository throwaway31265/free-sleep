import {
  Alert,
  Container,
  type ContainerProps,
  type SxProps,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type React from 'react';
import { useDeviceStatus } from '@/api/deviceStatus';

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
          flexGrow: 1,
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
        // Very narrow mobile devices (320px)
        '@media (max-width: 360px)': {
          width: '100%',
          padding: '12px', // Optimized padding for very narrow screens
          paddingBottom: 12,
          gap: 1.5, // Reduced gap for narrow screens
        },
        // Mobile (xs)
        [theme.breakpoints.down('sm')]: {
          width: '100%',
          padding: 2, // Increased from 1 to 2 for less cramped layout
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
          width: '70%', // Reduced from 75% to better center content
          padding: 0,
          paddingTop: 8,
          paddingBottom: 12,
          maxWidth: '1600px', // Increased from 1400px to better use wide screens
          minWidth: '1200px', // Added minimum width to prevent content from becoming too narrow
        },
        ...sx,
      }}
    >
      {children}
    </Container>
  );
}
