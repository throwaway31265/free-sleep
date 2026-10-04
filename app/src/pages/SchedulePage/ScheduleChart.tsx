/* eslint-disable react/no-multi-comp */
import { useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import { Paper } from '@mui/material';
import { LineChart, lineClasses } from '@mui/x-charts/LineChart';
import { useDrawingArea } from '@mui/x-charts/hooks';

import { useScheduleStore } from './scheduleStore.tsx';
import { DailySchedule, Time } from '../../../../server/src/db/schedulesSchema.ts';
import { useSettings } from '@api/settings.ts';
import {
  farenheitToCelcius,
  formatTemperature,
  MAX_TEMP_C,
  MAX_TEMP_F,
  MIN_TEMP_C,
  MIN_TEMP_F
} from '@lib/temperatureConversions.ts';


type Point = { x: Date; y: number };

const THRESHOLD_F = 82;
const THRESHOLD_C = farenheitToCelcius(THRESHOLD_F);
const AREA_ALPHA = 0.35;
const LINE_ALPHA = 1.0;

// ---------------- buildSeriesData (same as before) ----------------
const todayAt = (hhmm: Time, dayOffset = 0) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (dayOffset) d.setDate(d.getDate() + dayOffset);
  return d;
};


const compareTime = (a: Time, b: Time) => {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return ah - bh || am - bm;
};

function buildSeriesData(selectedSchedule: DailySchedule, yMin: number, yMax: number, isCelsius: boolean): Point[] {
  if (!selectedSchedule?.power.enabled) return [];

  const { power, temperatures } = selectedSchedule;
  const wraps = compareTime(power.off, power.on) <= 0;

  const start = todayAt(power.on, 0);
  const end = todayAt(power.off, wraps ? 1 : 0);

  const entries = Object.entries(temperatures) as [Time, number][];
  const day0: [Date, number][] = [];
  const day1: [Date, number][] = [];

  for (const [t, temp] of entries.sort((a, b) => compareTime(a[0], b[0]))) {
    if (!wraps) {
      if (compareTime(t, power.on) >= 0 && compareTime(t, power.off) <= 0)
        day0.push([todayAt(t, 0), temp]);
    } else {
      if (compareTime(t, power.on) >= 0) day0.push([todayAt(t, 0), temp]);
      if (compareTime(t, power.off) <= 0) day1.push([todayAt(t, 1), temp]);
    }
  }

  const points: Point[] = [{
    x: start,
    y: isCelsius ? farenheitToCelcius(power.onTemperature) : power.onTemperature
  }];
  const pushStep = (arr: [Date, number][]) => {
    for (const [dt, temp] of arr) {
      const convertedTemp = isCelsius ? farenheitToCelcius(temp) : temp;

      if (dt.getTime() > points[points.length - 1].x.getTime()) {
        points.push({ x: dt, y: convertedTemp });
      } else {
        points[points.length - 1].y = convertedTemp;
      }
    }
  };
  pushStep(day0);
  pushStep(day1);

  const lastY = points[points.length - 1].y;
  if (end.getTime() > points[points.length - 1].x.getTime()) {
    points.push({
      x: end,
      y: lastY
    }
    );
  }

  for (const p of points) p.y = Math.min(yMax, Math.max(yMin, Math.round(p.y)));

  return points;
}

// ---------------- Horizontal gradient by time ----------------
function HorizontalTempGradient({
  idArea,
  idLine,
  points,
  threshold,
  colorCool,
  colorHot,
  areaAlpha = AREA_ALPHA,
  lineAlpha = LINE_ALPHA,
}: {
  idArea: string;
  idLine: string;
  points: Point[];
  threshold: number;
  colorCool?: string;
  colorHot?: string;
  areaAlpha?: number;
  lineAlpha?: number;
}) {
  // We need the drawing area's left/width to build a left→right gradient.
  const { left, width, top } = useDrawingArea();

  // Normalize a Date->offset [0..1] across the x extent in the plotted window.
  const minX = points[0].x.getTime();
  const maxX = points[points.length - 1].x.getTime();
  const xToOff = (tMs: number) =>
    maxX === minX ? 0 : Math.max(0, Math.min(1, (tMs - minX) / (maxX - minX)));

  // Build stops where color should switch based on segment value (y at the segment start).
  // Because curve='stepAfter', y is constant until the next point.
  type Stop = { off: number; color: string };
  const stops: Stop[] = [];
  if (points.length) {
    let curColor = points[0].y >= threshold ? colorHot : colorCool;
    // @ts-expect-error
    stops.push({ off: 0, color: curColor });

    for (let i = 0; i < points.length - 1; i++) {
      const segStart = points[i];
      // const segEnd = points[i + 1];
      const segColor = segStart.y >= threshold ? colorHot : colorCool;

      // If color changes at this boundary, add a double stop at the boundary offset
      if (segColor !== curColor) {
        const off = xToOff(segStart.x.getTime()); // boundary is at the step where value changes
        // close previous color up to boundary
        // @ts-expect-error
        stops.push({ off: off - 0.05, color: curColor });
        // start new color at same boundary (hard switch)
        // @ts-expect-error
        stops.push({ off: off + 0.05, color: segColor });
        curColor = segColor;
      }
    }
    // Ensure final stop at 1 with the current color
    // @ts-expect-error
    stops.push({ off: 1, color: curColor });
  }

  return (
    <defs>
      <linearGradient
        id={ idArea }
        x1={ left }
        x2={ left + width }
        y1={ top }
        y2={ top }
        gradientUnits="userSpaceOnUse"
      >
        { stops.map((s, i) => (
          <stop key={ `a-${i}` } offset={ s.off } stopColor={ s.color } stopOpacity={ areaAlpha }/>
        )) }
      </linearGradient>
      <linearGradient
        id={ idLine }
        x1={ left }
        x2={ left + width }
        y1={ top }
        y2={ top }
        gradientUnits="userSpaceOnUse"
      >
        { stops.map((s, i) => (
          <stop key={ `l-${i}` } offset={ s.off } stopColor={ s.color } stopOpacity={ lineAlpha }/>
        )) }
      </linearGradient>
    </defs>
  );
}

// ---------------- Component ----------------
export default function TemperatureScheduleChart() {
  const { selectedSchedule } = useScheduleStore();
  const { data: settings } = useSettings();
  const theme = useTheme();

  const isCelsius = settings?.temperatureFormat === 'celsius';
  const yMin = isCelsius ? MIN_TEMP_C : MIN_TEMP_F;
  const yMax = isCelsius ? MAX_TEMP_C : MAX_TEMP_F;

  const points = useMemo(() => {
    if (!selectedSchedule) return [];
    return buildSeriesData(selectedSchedule, yMin, yMax, isCelsius);
  },
  [selectedSchedule, yMin, yMax, isCelsius],
  );

  if (!points.length) return null;
  const xData = points.map(p => p.x);
  const yData = points.map(p => p.y);
  const gradAreaId = 'temp-x-grad-area';
  const gradLineId = 'temp-x-grad-line';
  const axisColor = theme.palette.grey['600'];

  return (
    <Paper sx={ { width: '100%', height: 300, p: 2 } }>
      <LineChart
        xAxis={ [{
          scaleType: 'time',
          data: xData,
          valueFormatter: (v) =>
            new Date(v as number).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          min: xData[0],
          max: xData[xData.length - 1],
          tickMinStep: 60 * 60 * 1000,
          tickNumber: 4,
          label: '°F',
          tickLabelStyle: { fill: axisColor },
        }] }
        yAxis={ [{
          min: yMin,
          max: yMax,
          tickLabelStyle: { fill: axisColor },
          valueFormatter: (value: number) => formatTemperature(value, isCelsius) ,
        }] }
        series={ [{
          id: 'targeTempF',
          label: isCelsius ? 'Target °C' : 'Target °F',
          data: yData,
          area: true,
          showMark: false,
          curve: 'stepAfter',
        }] }
        margin={ {
          right: 0,
          left: 50,
          top: 5,
          bottom: 19
        } }
        sx={ {
          pt: 0,
          [`& .${lineClasses.line}`]: { stroke: `url(#${gradLineId})` },
          [`& .${lineClasses.area}`]: { fill: `url(#${gradAreaId})`, filter: 'none' },
          '& .MuiChartsAxis-bottom .MuiChartsAxis-line': {
            stroke: axisColor,
          },
          '& .MuiChartsAxis-bottom .MuiChartsAxis-tick': {
            stroke: axisColor,
          },
          '& .MuiChartsAxis-left .MuiChartsAxis-line': {
            stroke: axisColor,
          },
          '& .MuiChartsAxis-left .MuiChartsAxis-tick': {
            stroke: axisColor,
          },
          '& .MuiChartsGrid-line': {
            stroke: axisColor,
          },
        } }
        hideLegend
      >
        <HorizontalTempGradient
          idArea={ gradAreaId }
          idLine={ gradLineId }
          points={ points }
          threshold={ isCelsius ? THRESHOLD_C : THRESHOLD_F }
          colorCool="#2196f3"
          colorHot="#d32f2f"
          areaAlpha={ AREA_ALPHA }
          lineAlpha={ LINE_ALPHA }
        />
      </LineChart>
    </Paper>
  );
}
