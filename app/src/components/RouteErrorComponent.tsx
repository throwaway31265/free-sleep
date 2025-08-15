import { Box, Button, Typography } from '@mui/material';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import {
  ErrorComponent,
  type ErrorComponentProps,
  useRouter,
} from '@tanstack/react-router';
import { useEffect } from 'react';

export default function RouteErrorComponent({ error }: ErrorComponentProps) {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  useEffect(() => {
    // Reset the query error boundary when this component mounts
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);

  // Check if it's a network/API error
  const errorAny = error as any;
  const isNetworkError =
    error?.message?.includes('Network') ||
    error?.message?.includes('fetch') ||
    errorAny?.response?.status >= 500 ||
    errorAny?.code === 'ECONNREFUSED';

  const title = isNetworkError
    ? 'Unable to Connect to Server'
    : 'Something Went Wrong';

  const message = isNetworkError
    ? 'Please check that your Eight Sleep device is powered on and connected to your network.'
    : error?.message || 'An unexpected error occurred. Please try again.';

  // For development, show the full error
  if (import.meta.env.DEV) {
    return <ErrorComponent error={error} />;
  }

  // Production-friendly error display
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 6,
        px: 3,
        color: '#fff',
        minHeight: '50vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Typography variant="h5" sx={{ mb: 2, color: 'error.main' }}>
        {title}
      </Typography>
      <Typography
        variant="body1"
        sx={{ mb: 4, color: 'text.secondary', maxWidth: 600 }}
      >
        {message}
      </Typography>
      <Button
        onClick={() => {
          // Invalidate the route to reload the loader and reset error boundaries
          router.invalidate();
        }}
        variant="contained"
        size="large"
        sx={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
        }}
      >
        Try Again
      </Button>
    </Box>
  );
}
