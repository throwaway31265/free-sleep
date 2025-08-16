import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import BedIcon from '@mui/icons-material/Bed';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router';
import moment from 'moment-timezone';
import { useMemo } from 'react';
import { useSleepRecords } from '@api/sleep.ts';
import { useVitalsSummary } from '@api/vitals.ts';
import { useAppStore } from '@state/appStore.tsx';
import PageContainer from '@/components/shared/PageContainer.tsx';
import SectionCard from '@/components/shared/SectionCard.tsx';

export const Route = createFileRoute('/data/')({
  component: DataPage,
});

const RecentSleepCard = () => {
  const navigate = useNavigate();
  const { side } = useAppStore();

  const { startTime, endTime } = useMemo(() => {
    const end = moment();
    const start = moment().subtract(7, 'days');
    return {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
  }, []); // Empty dependency array since we want this to be calculated once

  const { data: sleepRecords, isLoading } = useSleepRecords({
    side,
    startTime,
    endTime,
  });

  const lastNight = sleepRecords && sleepRecords.length > 0 ? sleepRecords[sleepRecords.length - 1] : null;
  const avgSleepDuration = Array.isArray(sleepRecords) && sleepRecords.length > 0
    ? sleepRecords.reduce((sum, record) => sum + (record.sleep_period_seconds / 60), 0) / sleepRecords.length
    : 0;

  const formatDuration = (minutes: number) => {
    if (!minutes || isNaN(minutes)) {
      return '--';
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <SectionCard
      title="Recent Sleep"
      subheader="Last 7 days of sleep data"
    >
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress />
        </Box>
      ) : !sleepRecords?.length ? (
        <Alert severity="info">No sleep data available</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 2 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary">
                {lastNight ? formatDuration(lastNight.sleep_period_seconds / 60) : '--'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Last Night
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary">
                {formatDuration(avgSleepDuration)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                7-Day Average
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary">
                {Array.isArray(sleepRecords) && sleepRecords.length || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Sleep Sessions
              </Typography>
            </Box>
          </Box>

          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate({ to: '/data/sleep' })}
            endIcon={<ArrowForwardIosIcon />}
            sx={{ alignSelf: 'flex-start' }}
          >
            View All
          </Button>

          {lastNight && (
            <Box sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body2" color="text.secondary">
                Last sleep: {moment(lastNight.entered_bed_at).format('MMM D, h:mm A')} - {moment(lastNight.left_bed_at).format('h:mm A')}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </SectionCard>
  );
};

const RecentVitalsCard = () => {
  const navigate = useNavigate();
  const { side } = useAppStore();

  const { startTime, endTime } = useMemo(() => {
    const end = moment();
    const start = moment().subtract(1, 'day');
    return {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
  }, []); // Empty dependency array since we want this to be calculated once

  const { data: vitalsSummary, isLoading } = useVitalsSummary({
    startTime,
    endTime,
    side,
  });

  return (
    <SectionCard
      title="Health Metrics"
      subheader="Last 24 hours"
    >
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress />
        </Box>
      ) : !vitalsSummary ? (
        <Alert severity="info">No vitals data available</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 2 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="error.main">
                {vitalsSummary.avgHeartRate || '--'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Avg HR (bpm)
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary.main">
                {vitalsSummary.avgBreathingRate || '--'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Breathing (/min)
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="success.main">
                {vitalsSummary.avgHRV || '--'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                HRV (ms)
              </Typography>
            </Box>
          </Box>

          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate({ to: '/data/sleep' })}
            endIcon={<ArrowForwardIosIcon />}
            sx={{ alignSelf: 'flex-start' }}
          >
            View Details
          </Button>
        </Box>
      )}
    </SectionCard>
  );
};

const QuickActions = () => {
  const navigate = useNavigate();

  return (
    <SectionCard
      title="Quick Access"
      subheader="Navigate to detailed views"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<BedIcon />}
          endIcon={<ArrowForwardIosIcon />}
          onClick={() => navigate({ to: '/data/sleep' })}
          sx={{ justifyContent: 'space-between' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BedIcon />
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="body1">Sleep Analysis</Typography>
              <Typography variant="caption" color="text.secondary">
                Detailed sleep charts and trends
              </Typography>
            </Box>
          </Box>
          <ArrowForwardIosIcon fontSize="small" />
        </Button>

        <Button
          variant="outlined"
          fullWidth
          startIcon={<TextSnippetIcon />}
          endIcon={<ArrowForwardIosIcon />}
          onClick={() => navigate({ to: '/data/logs' })}
          sx={{ justifyContent: 'space-between' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextSnippetIcon />
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="body1">System Logs</Typography>
              <Typography variant="caption" color="text.secondary">
                Real-time system monitoring
              </Typography>
            </Box>
          </Box>
          <ArrowForwardIosIcon fontSize="small" />
        </Button>
      </Box>
    </SectionCard>
  );
};

// eslint-disable-next-line react/no-multi-comp
function DataPage() {
  const location = useLocation();
  // Check if we are on a child route (like /data/sleep or /data/logs)
  const isChildRoute = location.pathname !== '/data' && location.pathname !== '/data/';

  if (isChildRoute) {
    return <Outlet />;
  }

  return (
    <PageContainer sx={{ mt: 2 }}>
      <Typography variant="h4" sx={{ mb: 3, textAlign: 'center' }}>
        Data Dashboard
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: {
            xs: '1fr',
            md: '1fr 1fr',
            lg: 'repeat(3, 1fr)'
          },
          alignItems: 'start',
          width: '100%',
        }}
      >
        <RecentSleepCard />
        <RecentVitalsCard />
        <QuickActions />
      </Box>
    </PageContainer>
  );
}
