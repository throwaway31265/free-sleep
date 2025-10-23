import { ScatterChart } from '@mui/x-charts/ScatterChart';
import { Card, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import moment from 'moment';
import { useResizeDetector } from 'react-resize-detector';
import { MovementRecord } from '@api/movement.ts';

type MovementChartProps = {
  movementRecords: MovementRecord[];
  label: string;
}
export default function MovementChart({ movementRecords, label }: MovementChartProps) {
  const { width = 300, ref } = useResizeDetector();
  const theme = useTheme();
  if (!movementRecords || movementRecords.length === 0) return null;

  const color = theme.palette.primary.light;

  // Optional down sampling
  const pxPerPoint = 5;
  const allowedPoints = width / pxPerPoint;
  const downsampleTo = Math.ceil(movementRecords.length / allowedPoints);
  // @ts-ignore
  const downsampleData = (data, factor) => data.filter((_, i) => i % factor === 0);
  // @ts-ignore
  const cleanedRecords = downsampleData(movementRecords, downsampleTo).map((record) => ({
    id: record.id,
    timestamp: new Date(record.timestamp),
    total_movement: Number(record.total_movement),
  }));

  return (
    <Card sx={ { pt: 1, mt: 2, pl: 2 } }>
      <Typography variant="h6" gutterBottom>
        { label }
      </Typography>
      <ScatterChart
        ref={ ref }
        height={ 300 }
        dataset={ cleanedRecords }
        colors={ [color] }
        margin={ { left: 80, right: 30, top: 10, bottom: 40 } }
        xAxis={ [
          {
            id: 'timestamp-axis',
            dataKey: 'timestamp',
            scaleType: 'time',
            valueFormatter: (value) => moment(value).format('HH:mm'),
          },
        ] }
        yAxis={ [
          {
            id: 'movement-axis',
            dataKey: 'total_movement',
            colorMap: {
              type: 'piecewise', // or 'continuous' if you want gradient
              thresholds: [100, 300, 600, 1000],
              colors: ['#22c55e', '#eab308', '#f97316', '#ef4444'], // green → red
            },
          },
        ] }
        series={ [
          {
            label: label,
            datasetKeys: { id: 'id', x: 'timestamp', y: 'total_movement' },
            markerSize: 4,
          },
        ] }
        // grid={ { horizontal: true, vertical: true } }
        legend={ { hidden: true } }
      />
    </Card>
  );
}
