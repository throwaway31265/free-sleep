/* eslint-disable react/no-multi-comp */
import Alert, { AlertProps } from '@mui/material/Alert';
import Link from '@mui/material/Link';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import { LineChart } from '@mui/x-charts/LineChart';
import { Card, Typography } from '@mui/material';
import moment from 'moment-timezone';
import { useTheme } from '@mui/material/styles';
import { VitalsRecord } from '@api/vitals.ts';
import { useResizeDetector } from 'react-resize-detector';

type Metric = 'heart_rate' | 'hrv' | 'breathing_rate';
type VitalsLineChartProps = {
  vitalsRecords?: VitalsRecord[];
  metric: Metric;
};

const downsampleData = (data: VitalsRecord[], factor: number) => {
  return data.filter((_, index) => index % factor === 0);
};

type BannerProps = {
  metric: Metric;
  label: string;
}

type BannerMapping = {
  icon: React.ReactElement;
  severity: AlertProps['severity'];
  text: string | React.ReactElement;
}
type BannerMap = Record<Metric, BannerMapping>;

const Banner = ({ metric }: BannerProps) => {
  const bannerMap: BannerMap = {
    heart_rate: {
      icon: <InfoIcon color='info'/>,
      severity: 'info',
      text: <Typography>Heart rate data has been validated with six participants, and accuracy may be limited.
        You can help improve future accuracy by contributing your own data for validation or
        by experimenting and improving the algorithm yourself.
        See the <Link href='https://github.com/throwaway31265/free-sleep?tab=readme-ov-file#biometrics-'>documentation</Link>
        &nbsp;for details on current measurement accuracy.
      </Typography>,
    },
    breathing_rate: {
      icon: <WarningIcon color='warning'/>,
      severity: 'warning',
      text: 'Breath rate accuracy has not been verified.',
    },
    hrv: {
      icon: <WarningIcon color='warning'/>,
      severity: 'warning',
      text: 'HRV accuracy has not been verified.',
    }
  };
  return (
    <Alert icon={ bannerMap[metric].icon } severity={ bannerMap[metric].severity }>
      { bannerMap[metric].text }
    </Alert>
  );
};

export default function VitalsLineChart({ vitalsRecords, metric }: VitalsLineChartProps) {
  const { width = 300, ref } = useResizeDetector();
  const theme = useTheme();
  if (!vitalsRecords) return;
  const vitalsMap = {
    heart_rate: {
      label: 'Heart rate',
      color: theme.palette.error.main,
    },
    breathing_rate: {
      label: 'Breathing rate',
      color: theme.palette.primary.main,
    },
    hrv: {
      label: 'HRV',
      color: theme.palette.error.main,
    }
  };
  const { label, color } = vitalsMap[metric];

  const pxPerPoint = 3;
  const allowedPoints = width / pxPerPoint;
  const downsampleTo = Math.ceil(vitalsRecords.length / allowedPoints);

  const cleanedVitalsRecords = downsampleData(vitalsRecords, downsampleTo)
    .filter(
      (record) =>
        record.timestamp &&
        !isNaN(new Date(record.timestamp).getTime()) &&
        !isNaN(record[metric])
    )
    .map((record) => ({
      ...record,
      timestamp: new Date(record.timestamp),
      [metric]: Number(record[metric]),
    }));

  return (
    <Card sx={ { pt: 1, mt: 2, pl: 2, pr: 2, pb: 2 } }>
      <Typography variant="h6" gutterBottom>
        { label }
      </Typography>
      <LineChart
        ref={ ref }
        height={ 300 }
        colors={ [color] }
        dataset={ cleanedVitalsRecords }
        xAxis={ [
          {
            id: 'Years',
            dataKey: 'timestamp',
            scaleType: 'time',
            valueFormatter: (periodStart) =>
              moment(periodStart).format('HH:mm'),
          },
        ] }
        legend={ { hidden: true } }
        series={ [
          {
            id: label,
            label: label,
            dataKey: metric,
            valueFormatter: (metric) => (metric !== null && !isNaN(metric) ? metric.toFixed(0) : 'Invalid'),
            showMark: false,
          },
        ] }
      />
      <Banner metric={ metric } label={ vitalsMap[metric].label } />

    </Card>
  );
}
