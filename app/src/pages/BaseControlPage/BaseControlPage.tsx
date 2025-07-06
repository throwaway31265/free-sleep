import BedIcon from '@mui/icons-material/Bed';
import HotelIcon from '@mui/icons-material/Hotel';
import WeekendIcon from '@mui/icons-material/Weekend';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useAppStore } from '@state/appStore';
import { useEffect, useState, useMemo } from 'react';
import PageContainer from '../PageContainer';
import {
  useBaseStatus,
  useSetBasePosition,
  useSetBasePreset,
  useStopBase,
} from '@api/baseControl';

interface BasePosition {
  head: number;
  feet: number;
}

const presets = {
  flat: { head: 0, feet: 0 },
  sleep: { head: 10, feet: 5 },
  relax: { head: 30, feet: 15 },
};

export default function BaseControlPage() {
  const theme = useTheme();
  const { isUpdating } = useAppStore();
  const [position, setPosition] = useState<BasePosition>({ head: 0, feet: 0 });

  const { data: baseStatus, isLoading } = useBaseStatus();
  const setBasePositionMutation = useSetBasePosition();
  const setBasePresetMutation = useSetBasePreset();
  const stopBaseMutation = useStopBase();

  // Update local state when base status changes, but only when meaningful changes occur
  useEffect(() => {
    if (baseStatus && !baseStatus.isMoving) {
      setPosition((prev) => {
        // Only update if the position has actually changed
        if (prev.head !== baseStatus.head || prev.feet !== baseStatus.feet) {
          return { head: baseStatus.head, feet: baseStatus.feet };
        }
        return prev;
      });
    }
  }, [baseStatus?.head, baseStatus?.feet, baseStatus?.isMoving]);

  const handleHeadChange = (_: Event, newValue: number | number[]) => {
    setPosition((prev) => ({ ...prev, head: newValue as number }));
  };

  const handleFeetChange = (_: Event, newValue: number | number[]) => {
    setPosition((prev) => ({ ...prev, feet: newValue as number }));
  };

  const handlePresetClick = async (preset: keyof typeof presets) => {
    setPosition(presets[preset]);
    await setBasePresetMutation.mutateAsync(preset);
  };

  const applyPosition = async () => {
    await setBasePositionMutation.mutateAsync({
      head: position.head,
      feet: position.feet,
      feedRate: 50, // Default feed rate
    });
  };

  const handleStop = async () => {
    await stopBaseMutation.mutateAsync();
  };

  const isMoving = baseStatus?.isMoving || false;
  const isMutating =
    setBasePositionMutation.isPending ||
    setBasePresetMutation.isPending ||
    stopBaseMutation.isPending;

  // Memoize preset button states to avoid unnecessary re-renders
  const presetButtonStates = useMemo(
    () => ({
      flat:
        position.head === presets.flat.head &&
        position.feet === presets.flat.feet,
      sleep:
        position.head === presets.sleep.head &&
        position.feet === presets.sleep.feet,
      relax:
        position.head === presets.relax.head &&
        position.feet === presets.relax.feet,
    }),
    [position.head, position.feet],
  );

  return (
    <PageContainer
      sx={{
        maxWidth: '500px',
        [theme.breakpoints.up('md')]: {
          maxWidth: '400px',
        },
      }}
    >
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Base Control
      </Typography>

      {/* Loading indicator */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {/* Movement status */}
      {isMoving && !isMutating && (
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="body2" color="primary">
            Base is moving...
          </Typography>
        </Box>
      )}

      {/* Preset Buttons */}
      <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
        <Button
          variant={presetButtonStates.flat ? 'contained' : 'outlined'}
          onClick={() => handlePresetClick('flat')}
          disabled={isUpdating || isMoving || isMutating}
          startIcon={<BedIcon />}
          fullWidth
        >
          Flat
        </Button>
        <Button
          variant={presetButtonStates.sleep ? 'contained' : 'outlined'}
          onClick={() => handlePresetClick('sleep')}
          disabled={isUpdating || isMoving || isMutating}
          startIcon={<HotelIcon />}
          fullWidth
        >
          Sleep
        </Button>
        <Button
          variant={presetButtonStates.relax ? 'contained' : 'outlined'}
          onClick={() => handlePresetClick('relax')}
          disabled={isUpdating || isMoving || isMutating}
          startIcon={<WeekendIcon />}
          fullWidth
        >
          Relax
        </Button>
      </Stack>

      {/* Head Control */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Head Height
          </Typography>
          <Box sx={{ px: 2, py: 3 }}>
            <Slider
              value={position.head}
              onChange={handleHeadChange}
              min={0}
              max={45}
              step={1}
              marks={[
                { value: 0, label: '0°' },
                { value: 15, label: '15°' },
                { value: 30, label: '30°' },
                { value: 45, label: '45°' },
              ]}
              valueLabelDisplay="on"
              valueLabelFormat={(value) => `${value}°`}
              disabled={isUpdating || isMoving || isMutating}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Feet Control */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Feet Height
          </Typography>
          <Box sx={{ px: 2, py: 3 }}>
            <Slider
              value={position.feet}
              onChange={handleFeetChange}
              min={0}
              max={30}
              step={1}
              marks={[
                { value: 0, label: '0°' },
                { value: 10, label: '10°' },
                { value: 20, label: '20°' },
                { value: 30, label: '30°' },
              ]}
              valueLabelDisplay="on"
              valueLabelFormat={(value) => `${value}°`}
              disabled={isUpdating || isMoving || isMutating}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Stack spacing={2} sx={{ mt: 2 }}>
        <Button
          variant="contained"
          onClick={applyPosition}
          disabled={isUpdating || isMutating || isMoving}
          size="large"
          fullWidth
        >
          {setBasePositionMutation.isPending || setBasePresetMutation.isPending
            ? 'Sending...'
            : 'Apply Position'}
        </Button>

        <Button
          variant="contained"
          color="error"
          onClick={handleStop}
          disabled={!isMoving || stopBaseMutation.isPending}
          size="large"
          fullWidth
        >
          {stopBaseMutation.isPending ? 'Stopping...' : 'Emergency Stop'}
        </Button>
      </Stack>
    </PageContainer>
  );
}
