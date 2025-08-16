import { Alert, Collapse } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';

export default function ErrorDisplay() {
  const { error, clearError } = useAppStore();

  return (
    <Collapse in={!!error}>
      <Alert
        severity="error"
        onClose={clearError}
        sx={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          maxWidth: '90%',
          minWidth: '300px',
        }}
      >
        {error}
      </Alert>
    </Collapse>
  );
}
