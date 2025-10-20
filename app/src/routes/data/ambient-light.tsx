import {
  useAmbientLightReadings,
  useAmbientLightSummary,
  useLatestAmbientLight,
} from '@api/ambientLight.ts';
import LightModeIcon from '@mui/icons-material/LightMode';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import moment from 'moment-timezone';
import { useMemo } from 'react';
import Header from '@/components/data/Header.tsx';
import PageContainer from '@/components/shared/PageContainer.tsx';
import SectionCard from '@/components/shared/SectionCard.tsx';

export const Route = createFileRoute('/data/ambient-light')({
  component: AmbientLightPage,
});

const CurrentLuxCard = () => {
  const { data: latestReading, isLoading } = useLatestAmbientLight();

  return (
    <SectionCard title="Current Light Level" subheader="Real-time measurement">
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress />
        </Box>
      ) : !latestReading ? (
        <Alert severity="info">No ambient light data available</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h2" color="primary" fontWeight="bold">
              {latestReading.lux.toFixed(2)}
            </Typography>
            <Typography variant="h6" color="text.secondary">
              lux
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Last updated: {moment(latestReading.datetime).format('h:mm:ss A')}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 2,
              pt: 2,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {latestReading.lux < 10 ? '🌙 Dark' :
                 latestReading.lux < 50 ? '🌆 Dim' :
                 latestReading.lux < 300 ? '💡 Indoor' :
                 latestReading.lux < 1000 ? '🏙️ Bright' : '☀️ Very Bright'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Light Condition
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </SectionCard>
  );
};

const LuxSummaryCard = () => {
  const { startTime, endTime } = useMemo(() => {
    const end = moment();
    const start = moment().subtract(24, 'hours');
    return {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
  }, []);

  const { data: summary, isLoading } = useAmbientLightSummary({
    startTime,
    endTime,
  });

  return (
    <SectionCard title="24-Hour Summary" subheader="Statistics for last 24 hours">
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress />
        </Box>
      ) : !summary || summary.count === 0 ? (
        <Alert severity="info">No data available for the last 24 hours</Alert>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: 2,
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="primary">
              {summary.avgLux.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Average Lux
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="success.main">
              {summary.maxLux.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Peak Lux
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="warning.main">
              {summary.minLux.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Minimum Lux
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="info.main">
              {summary.count}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Readings
            </Typography>
          </Box>
        </Box>
      )}
    </SectionCard>
  );
};

const LuxChartCard = () => {
  const { startTime, endTime } = useMemo(() => {
    const end = moment();
    const start = moment().subtract(24, 'hours');
    return {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
  }, []);

  const { data: readings, isLoading } = useAmbientLightReadings({
    startTime,
    endTime,
  });

  const chartData = useMemo(() => {
    if (!readings) return [];
    return readings.map((reading) => ({
      time: moment(reading.datetime).format('HH:mm'),
      lux: reading.lux,
      timestamp: reading.timestamp,
    }));
  }, [readings]);

  return (
    <SectionCard title="Light Level History" subheader="Last 24 hours">
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress />
        </Box>
      ) : !readings || readings.length === 0 ? (
        <Alert severity="info">No historical data available</Alert>
      ) : (
        <Box sx={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis
                label={{ value: 'Lux', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(2)} lux`, 'Light Level']}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="lux"
                stroke="#FFA726"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}
    </SectionCard>
  );
};

function AmbientLightPage() {
  return (
    <PageContainer sx={{ gap: 2 }}>
      <Header title="Ambient Light Sensor" icon={<LightModeIcon />} />

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: {
            xs: '1fr',
            md: '1fr 1fr',
          },
          alignItems: 'start',
        }}
      >
        <CurrentLuxCard />
        <LuxSummaryCard />
      </Box>

      <LuxChartCard />

      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          About Lux Measurements
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Lux is a measure of illuminance, or the amount of light hitting a surface.
          The OPT4001 ambient light sensor measures light levels in your environment.
        </Typography>
        <Box component="ul" sx={{ pl: 2, mt: 1 }}>
          <Typography component="li" variant="body2" color="text.secondary">
            0-10 lux: Dark room, nighttime
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            10-50 lux: Dimly lit room
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            50-300 lux: Typical indoor lighting
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            300-1000 lux: Bright indoor lighting, overcast daylight
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            1000+ lux: Direct sunlight through window, outdoor lighting
          </Typography>
        </Box>
      </Paper>
    </PageContainer>
  );
}
