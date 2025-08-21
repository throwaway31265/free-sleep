import { Box, Card, CardContent, Typography, FormControl, InputLabel, Select, MenuItem, Chip } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getWaterLevelReadings, getWaterLevelSummary } from '../api/waterLevel';

interface ChartDataPoint {
  timestamp: number;
  time: string;
  rawLevel: number;
  percentage?: number;
  calibratedEmpty?: number;
  calibratedFull?: number;
  isPriming?: boolean;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric'
  });
}

function getTrendColor(trend: string): 'success' | 'warning' | 'error' | 'default' {
  switch (trend) {
    case 'rising':
      return 'success';
    case 'stable':
      return 'default';
    case 'declining':
      return 'warning';
    default:
      return 'default';
  }
}

function getTrendIcon(trend: string): string {
  switch (trend) {
    case 'rising':
      return '↗️';
    case 'stable':
      return '➡️';
    case 'declining':
      return '↘️';
    default:
      return '➡️';
  }
}

function calculatePercentage(rawLevel: number, calibratedEmpty?: number, calibratedFull?: number): number | undefined {
  if (calibratedEmpty === undefined || calibratedFull === undefined) {
    return undefined;
  }
  
  const range = calibratedFull - calibratedEmpty;
  const levelAboveEmpty = rawLevel - calibratedEmpty;
  const percentage = (levelAboveEmpty / range) * 100;
  
  return Math.max(0, Math.min(100, percentage));
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const percentage = calculatePercentage(data.rawLevel, data.calibratedEmpty, data.calibratedFull);
    
    return (
      <Box
        sx={{
          bgcolor: 'background.paper',
          p: 1,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          boxShadow: 2,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
          {new Date(data.timestamp * 1000).toLocaleString()}
        </Typography>
        <br />
        {percentage !== undefined && (
          <>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              Level: {percentage.toFixed(1)}%
            </Typography>
            <br />
          </>
        )}
        <Typography variant="caption">
          Raw Level: {data.rawLevel.toFixed(4)}
        </Typography>
        {data.calibratedEmpty !== undefined && (
          <>
            <br />
            <Typography variant="caption" color="text.secondary">
              Empty Cal: {data.calibratedEmpty.toFixed(3)}
            </Typography>
          </>
        )}
        {data.calibratedFull !== undefined && (
          <>
            <br />
            <Typography variant="caption" color="text.secondary">
              Full Cal: {data.calibratedFull.toFixed(3)}
            </Typography>
          </>
        )}
        {data.isPriming && (
          <>
            <br />
            <Typography variant="caption" color="warning.main">
              🔄 Priming
            </Typography>
          </>
        )}
      </Box>
    );
  }
  return null;
};

export default function WaterLevelChart() {
  const [timeRange, setTimeRange] = useState(6); // Default to 6 hours

  const { data: readings = [], isLoading: readingsLoading } = useQuery({
    queryKey: ['water-level-readings', timeRange],
    queryFn: () => getWaterLevelReadings(timeRange),
    refetchInterval: 60000, // Refetch every minute
    retry: 3,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['water-level-summary'],
    queryFn: getWaterLevelSummary,
    refetchInterval: 60000, // Refetch every minute
    retry: 3,
  });

  // Transform readings for chart
  const chartData: ChartDataPoint[] = readings.map(reading => ({
    timestamp: reading.timestamp,
    time: formatTimestamp(reading.timestamp),
    rawLevel: reading.rawLevel,
    percentage: calculatePercentage(reading.rawLevel, reading.calibratedEmpty, reading.calibratedFull),
    calibratedEmpty: reading.calibratedEmpty,
    calibratedFull: reading.calibratedFull,
    isPriming: reading.isPriming,
  }));

  // Get reference lines for calibrated values (use most recent values)
  const latestReading = readings[readings.length - 1];
  const calibratedEmpty = latestReading?.calibratedEmpty;
  const calibratedFull = latestReading?.calibratedFull;

  if (readingsLoading || summaryLoading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Water Level Trends
          </Typography>
          <Typography color="text.secondary">Loading...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Water Level Trends
          </Typography>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(Number(e.target.value))}
            >
              <MenuItem value={1}>1 Hour</MenuItem>
              <MenuItem value={3}>3 Hours</MenuItem>
              <MenuItem value={6}>6 Hours</MenuItem>
              <MenuItem value={12}>12 Hours</MenuItem>
              <MenuItem value={24}>24 Hours</MenuItem>
              <MenuItem value={48}>48 Hours</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Status Summary */}
        {summary && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Chip
              label={`Current: ${summary.currentLevel?.toFixed(1)}%` || 'N/A'}
              size="small"
              variant="outlined"
              color={summary.currentLevel !== undefined && summary.currentLevel < 20 ? 'error' : 'default'}
            />
            <Chip
              label={`Raw: ${summary.rawLevel?.toFixed(4) || 'N/A'}`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`${getTrendIcon(summary.trend)} ${summary.trend}`}
              size="small"
              color={getTrendColor(summary.trend)}
            />
            <Chip
              label={`Rate: ${summary.changeRate.toFixed(4)}/hr`}
              size="small"
              variant="outlined"
            />
            {summary.activeAlerts > 0 && (
              <Chip
                label={`${summary.activeAlerts} Alert${summary.activeAlerts > 1 ? 's' : ''}`}
                size="small"
                color="error"
              />
            )}
            <Chip
              label={`${summary.readingsCount} readings`}
              size="small"
              variant="outlined"
            />
            {summary.calibration && (
              <Chip
                label={`Range: ${summary.calibration.range?.toFixed(3) || 'N/A'}`}
                size="small"
                variant="outlined"
              />
            )}
            {!summary.isMonitoring && (
              <Chip
                label="Not Monitoring"
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
          </Box>
        )}

        {chartData.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No water level data available for the selected time range.
          </Typography>
        ) : (
          <Box sx={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['dataMin - 0.01', 'dataMax + 0.01']}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value.toFixed(3)}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Reference lines for calibrated empty/full */}
                {calibratedEmpty && (
                  <ReferenceLine
                    y={calibratedEmpty}
                    stroke="#ff9800"
                    strokeDasharray="5 5"
                    label={{ value: "Empty", position: "left" }}
                  />
                )}
                {calibratedFull && (
                  <ReferenceLine
                    y={calibratedFull}
                    stroke="#4caf50"
                    strokeDasharray="5 5"
                    label={{ value: "Full", position: "left" }}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="rawLevel"
                  stroke="#1976d2"
                  strokeWidth={2}
                  dot={(props: any) => {
                    const { payload, key, ...circleProps } = props;
                    if (payload?.isPriming) {
                      return <circle {...circleProps} r={4} fill="#ff9800" stroke="#ff9800" />;
                    }
                    return <circle {...circleProps} r={2} />;
                  }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          🔵 Raw Water Level {calibratedEmpty && '🟠 Calibrated Empty'} {calibratedFull && '🟢 Calibrated Full'} 🟠 Priming Events
        </Typography>
      </CardContent>
    </Card>
  );
}
