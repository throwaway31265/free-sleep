import CircularProgress from '@mui/material/CircularProgress';
import { useAppStore } from '@state/appStore.tsx';
import { useVitalsSummary } from '@api/vitals.ts';
import { Box, Card, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

type BiometricsSummaryCardProps = {
  startTime: string;
  endTime: string;
};

type TileProps = {
  title: string;
  value: number;
  unit: string;
};

const Tile = ({ title, value, unit }: TileProps) => {
  const theme = useTheme();
  return (
    <Box key={title} textAlign="center" flex={1} minWidth="30%">
      <Typography variant="body2" color={theme.palette.grey[400]}>
        {title}
      </Typography>
      <Typography
        variant="body1"
        fontWeight="bold"
        color={theme.palette.grey[100]}
      >
        {value ? value : '--'}{' '}
        <Typography
          variant="body2"
          component="span"
          color={theme.palette.grey[400]}
        >
          {unit}
        </Typography>
      </Typography>
    </Box>
  );
};

// eslint-disable-next-line react/no-multi-comp
export default function VitalsSummaryCard({
  startTime,
  endTime,
}: BiometricsSummaryCardProps) {
  const { side } = useAppStore();
  const { data: vitalsSummary, isFetching } = useVitalsSummary({
    startTime,
    endTime,
    side,
  });

  return (
    <Card
      sx={{
        p: 2,
        backgroundColor: 'background.paper',
        position: 'relative',
        mt: 2,
      }}
    >
      <Typography variant="h6" gutterBottom>
        Health metrics
      </Typography>
      {isFetching && (
        <CircularProgress sx={{ display: 'block', mx: 'auto', my: 2 }} />
      )}
      {!isFetching && vitalsSummary !== undefined && (
        <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2}>
          <Tile
            value={vitalsSummary.avgHeartRate}
            title="Heart rate"
            unit="bpm"
          />
          <Tile value={vitalsSummary.minHeartRate} title="Min HR" unit="bpm" />
          <Tile value={vitalsSummary.maxHeartRate} title="Max HR" unit="bpm" />
          <Tile value={vitalsSummary.avgHRV} title="HRV" unit="ms" />
          <Tile
            value={vitalsSummary.avgBreathingRate}
            title="Breath rate"
            unit="/min"
          />
        </Box>
      )}
    </Card>
  );
}
