import { postDeviceStatus } from '@api/deviceStatus.ts';
import Button from '@mui/material/Button';
import { useAppStore } from '@state/appStore.tsx';

type PrimeButtonProps = {
  refetch: any;
};

export default function PrimeButton({ refetch }: PrimeButtonProps) {
  const { setIsUpdating, isUpdating, setError, clearError } = useAppStore();

  const handleClick = () => {
    setIsUpdating(true);
    clearError(); // Clear any previous errors
    postDeviceStatus({
      isPriming: true,
    })
      .then(() => {
        // Wait 1 second before refreshing the device status
        return new Promise((resolve) => setTimeout(resolve, 1_000));
      })
      .then(() => refetch())
      .catch((error) => {
        console.error(error);

        // Extract meaningful error message for user
        let errorMessage = 'Failed to start priming';

        if (error.response?.status === 400) {
          if (error.response?.data?.details) {
            errorMessage = `Invalid priming request: ${error.response.data.details}`;
          } else {
            errorMessage = 'Invalid priming request. Please try again.';
          }
        } else if (error.response?.status === 500) {
          errorMessage = 'Server error. Please try again in a moment.';
        } else if (error.response?.status === 503) {
          errorMessage = error.response?.data?.message || 'Device unavailable. Please try again in a moment.';
        } else if (error.code === 'NETWORK_ERROR' || !error.response) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }

        setError(errorMessage);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };

  return (
    <Button variant="contained" onClick={handleClick} disabled={isUpdating}>
      Prime now
    </Button>
  );
}
