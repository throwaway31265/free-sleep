import { Box, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import LeakAlertNotification from '@/components/LeakAlertNotification.tsx';
import PageContainer from '@/components/shared/PageContainer.tsx';
import WaterLevelChart from '@/components/WaterLevelChart.tsx';

function WaterLevelPage() {
  return (
    <PageContainer>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: { xs: '100%', sm: '800px', md: '1000px', lg: '1200px' },
          margin: '0 auto',
          width: '100%',
          gap: 3,
          p: 2,
        }}
      >
        <Typography
          variant="h3"
          component="h1"
          sx={{
            textAlign: 'center',
            color: 'primary.main',
            fontWeight: 'bold',
            mb: 4,
            fontSize: { xs: '1.75rem', sm: '2.125rem' },
          }}
        >
          Water Level Monitoring
        </Typography>

        <Typography
          variant="subtitle1"
          sx={{
            textAlign: 'center',
            color: 'text.secondary',
            maxWidth: '600px',
            mb: 2,
          }}
        >
          Monitor your 8 Sleep system's water levels and detect potential leaks
          before they become major issues.
        </Typography>

        {/* Leak alerts at the top for visibility */}
        <Box sx={{ width: '100%' }}>
          <LeakAlertNotification />
        </Box>

        {/* Water level chart */}
        <Box sx={{ width: '100%' }}>
          <WaterLevelChart />
        </Box>

        {/* Information section */}
        <Box
          sx={{
            width: '100%',
            maxWidth: '800px',
            bgcolor: 'background.paper',
            p: 3,
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" gutterBottom>
            About Water Level Monitoring
          </Typography>

          <Typography variant="body2" color="text.secondary" paragraph>
            This system tracks the raw water level sensor values from your 8
            Sleep pod to detect potential leaks before your tank goes completely
            empty. The monitoring system analyzes trends over time and can
            detect both slow leaks (gradual drainage) and fast leaks (rapid
            water loss).
          </Typography>

          <Typography variant="body2" color="text.secondary" paragraph>
            <strong>What the chart shows:</strong>
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            component="ul"
            sx={{ ml: 2 }}
          >
            <li>
              <strong>Blue Line:</strong> Raw water level sensor readings
            </li>
            <li>
              <strong>Orange Dashed Line:</strong> Calibrated "empty" level
            </li>
            <li>
              <strong>Green Dashed Line:</strong> Calibrated "full" level
            </li>
            <li>
              <strong>Orange Dots:</strong> Readings taken during priming cycles
            </li>
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            paragraph
            sx={{ mt: 2 }}
          >
            <strong>Alert Types:</strong>
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            component="ul"
            sx={{ ml: 2 }}
          >
            <li>
              <strong>Slow Leak:</strong> Gradual water level decrease over
              hours
            </li>
            <li>
              <strong>Fast Leak:</strong> Rapid water loss indicating a
              significant leak
            </li>
            <li>
              <strong>Sensor Anomaly:</strong> Unusual sensor readings that may
              indicate calibration issues
            </li>
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            The system checks for leaks every 30 minutes and maintains 30 days
            of water level history.
          </Typography>
        </Box>
      </Box>
    </PageContainer>
  );
}

export const Route = createFileRoute('/water-level')({
  component: WaterLevelPage,
});
