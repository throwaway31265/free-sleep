import { useMemo } from 'react';
import { Card, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { LineChart, lineClasses } from '@mui/x-charts/LineChart';
import { useResizeDetector } from 'react-resize-detector';
import moment from 'moment-timezone';
import type { MovementRecord } from '@api/movement.ts';

type MovementChartProps = {
  movementRecords: MovementRecord[];
  label: string;
  bucketMs?: number;
  minActiveMs?: number;
};

type Pt = { x: Date; y: number };

// -----------------------------------------------------
// PHASE LEVELS (final enumerated form)
// -----------------------------------------------------

// Original movement thresholds mapped to enumerated values
function snapToEnumLevel(v: number): number {
  if (v >= 900) return 3; // Awake
  if (v >= 200) return 2; // Light
  return 1; // REM
}

/** Max-pool inside fixed time buckets */
function bucketMaxByTime(items: { t: number; v: number }[], bucketMs: number) {
  if (!items.length) return [];

  const out: { t: number; v: number }[] = [];

  let bucketStart = Math.floor(items[0].t / bucketMs) * bucketMs;
  let bucketEnd = bucketStart + bucketMs;

  let maxT = items[0].t;
  let maxV = -Infinity;

  let i = 0;
  while (i < items.length) {
    const { t, v } = items[i];
    if (t < bucketEnd) {
      if (v > maxV) { maxV = v; maxT = t; }
      i++;
    } else {
      out.push({ t: maxT, v: maxV === -Infinity ? 0 : maxV });
      bucketStart = bucketEnd;
      bucketEnd = bucketStart + bucketMs;
      maxV = -Infinity;
      maxT = bucketStart;
    }
  }

  out.push({ t: maxT, v: maxV === -Infinity ? 0 : maxV });
  return out;
}

/** Expand non-REM phases (>=2) to at least a 10 min block */
function expandActiveWindows(
  points: Pt[],
  bucketMs: number,
  minActiveMs: number,
): Pt[] {
  if (!points.length) return points;

  const radius = Math.ceil(minActiveMs / bucketMs / 2); // dilation radius
  const ys = points.map(p => p.y);
  const out = ys.slice();

  for (let i = 0; i < ys.length; i++) {
    if (ys[i] >= 2) {
      const j0 = Math.max(0, i - radius);
      const j1 = Math.min(ys.length - 1, i + radius);
      for (let j = j0; j <= j1; j++) {
        // expand to same enum level
        out[j] = Math.max(out[j], ys[i]);
      }
    }
  }

  return points.map((p, index) => ({ x: p.x, y: out[index] }));
}

// --------------------------------------------------------

export default function MovementAreaChart({
  movementRecords,
  label,
  bucketMs = 60_000, // 1 min buckets
  minActiveMs = 10 * 60_000, // expand active blocks to 10 minutes
}: MovementChartProps) {
  const theme = useTheme();
  const { width = 360, ref } = useResizeDetector();

  const points = useMemo<Pt[]>(() => {
    if (!movementRecords?.length) return [];

    // Sort & normalize input
    const raw = [...movementRecords]
      .map(r => ({ t: new Date(r.timestamp).getTime(), v: Number(r.total_movement) }))
      .sort((a, b) => a.t - b.t);

    // Time-based max pooling
    const pooled = bucketMaxByTime(raw, bucketMs);

    // Snap to enumerated levels (1, 2, 3)
    const snapped = pooled.map(p => ({
      x: new Date(p.t),
      y: snapToEnumLevel(p.v),
    }));

    // Expand active blocks (>=2)
    return expandActiveWindows(snapped, bucketMs, minActiveMs);
  }, [movementRecords, bucketMs, minActiveMs, width]);

  if (!points.length) return null;

  const xData = points.map(p => p.x);
  const yData = points.map(p => p.y);

  return (
    <Card sx={ { pt: 1, mt: 2, pl: 2 } }>
      <Typography variant="h6" gutterBottom>{ label }</Typography>

      <LineChart
        ref={ ref }
        height={ 300 }
        xAxis={ [{
          scaleType: 'time',
          data: xData,
          valueFormatter: (v) => moment(v as number).format('HH:mm'),
          min: xData[0],
          max: xData[xData.length - 1],
          tickMinStep: 60 * 60 * 1000,
          tickNumber: 4,
        }] }
        yAxis={ [{
          min: 0,
          max: 3,
          tickMinStep: 1,
          valueFormatter: (value: number) => {
            const labels: Record<number, string> = { 1: 'REM', 2: 'Light', 3: 'Awake' };
            return labels[Number(value)] ?? ''; // hide any unexpected ticks
          },
        }] }
        series={ [{
          id: 'movement-phase',
          label,
          data: yData,
          area: true,
          showMark: false,
          curve: 'stepAfter',
        }] }
        margin={ { left: 70, right: 30, top: 10, bottom: 40 } }
        hideLegend
        sx={ {
          [`& .${lineClasses.line}`]: { stroke: theme.palette.secondary.dark },
          [`& .${lineClasses.area}`]: { fill: theme.palette.secondary.dark, opacity: 0.70, filter: 'none' },
        } }
      />
    </Card>
  );
}
