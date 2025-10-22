/* eslint-disable react/no-multi-comp */
import moment from 'moment-timezone';
import { useServerStatus } from '@api/serverStatus.ts';
import { StatusInfo, Status } from '@api/serverStatusSchema.ts';
import {
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';

import PageContainer from '../PageContainer.tsx';

const statusMeta: Record<
  Status,
  { color: 'default' | 'info' | 'warning' | 'error' | 'success'; icon: React.ReactNode; label: string }
> = {
  not_started: {
    color: 'default',
    icon: <HourglassEmptyRoundedIcon fontSize="small" />,
    label: 'Not started',
  },
  started: {
    color: 'info',
    icon: <InfoRoundedIcon fontSize="small" />,
    label: 'Started',
  },
  restarting: {
    color: 'warning',
    icon: <ReplayRoundedIcon fontSize="small" />,
    label: 'Restarting',
  },
  retrying: {
    color: 'warning',
    icon: <AutorenewRoundedIcon fontSize="small" />,
    label: 'Retrying',
  },
  failed: {
    color: 'error',
    icon: <ErrorRoundedIcon fontSize="small" />,
    label: 'Failed',
  },
  healthy: {
    color: 'success',
    icon: <CheckCircleRoundedIcon fontSize="small" />,
    label: 'Healthy',
  },
};

function StatusChip({ info }: { info: StatusInfo }) {
  const meta = statusMeta[info.status];
  return (
    <Chip
      icon={ meta.icon as any }
      label={ meta.label }
      color={ meta.color }
      variant={ meta.color === 'default' ? 'outlined' : 'filled' }
      size="small"
      sx={ { fontWeight: 600 } }
    />
  );
}

function StatusCard({
  name,
  info,
}: {
  name: string;
  info: StatusInfo;
}) {
  return (
    <Card
      variant="outlined"
      sx={ {
        height: '100%', borderRadius: 3,
        '& .MuiCardHeader-root': { pb: 0.25 },
        '& .MuiCardContent-root': { pt: 0.75 },
      } }

    >
      <CardHeader
        title={
          <Stack direction="row" spacing={ 1.25 } alignItems="center">
            <Typography variant="subtitle1" fontWeight={ 700 }>
              { name }
            </Typography>
            <StatusChip info={ info } />
          </Stack>
        }
      />
      <CardContent>
        <Typography
          variant="body2"
          sx={ {
            color: (t) => t.palette.text.secondary,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            minHeight: 24,
          } }
        >
          { info.description }
        </Typography>
        {
          info.message && (
            <Typography
              variant="body2"
              sx={ {
                color: (t) => t.palette.text.secondary,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                minHeight: 24,
              } }
            >
              { info.message || '—' }
            </Typography>
          )
        }
      </CardContent>

    </Card>
  );
}

export default function StatusPage() {
  const { data, isLoading, dataUpdatedAt } = useServerStatus();
  if (isLoading || !data) return null;
  const updatedAt = moment(dataUpdatedAt);
  const formatted = updatedAt.format('YYYY-MM-DD HH:mm:ss z'); // e.g. "2025-10-22 14:05:12 PDT"

  return (
    <PageContainer
      sx={ {
        width: '100%',
        maxWidth: { xs: '100%', sm: '800px' },
        mx: 'auto',
        mb: 15,
      } }
    >
      <Stack spacing={ 1 } alignItems="center">
        <Typography variant="h5" fontWeight={ 800 }>
          Server Status
        </Typography>
        <Typography
          variant="body2"
          sx={ {
            color: (t) => t.palette.text.secondary,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            minHeight: 24,
          } }
        >
          Updated at: { formatted }
        </Typography>

      </Stack>

      <Grid container spacing={ 2.5 } sx={ { mt: 1 } }>
        <Grid item xs={ 12 } sm={ 6 } md={ 4 }>
          <StatusCard name="Franken" info={ data.franken } />
        </Grid>
        <Grid item xs={ 12 } sm={ 6 } md={ 4 }>
          <StatusCard name="Jobs" info={ data.jobs } />
        </Grid>
        <Grid item xs={ 12 } sm={ 6 } md={ 4 }>
          <StatusCard name="System Date" info={ data.systemDate } />
        </Grid>
        <Grid item xs={ 12 } sm={ 6 } md={ 4 }>
          <StatusCard name="Express" info={ data.express } />
        </Grid>
        <Grid item xs={ 12 } sm={ 6 } md={ 4 }>
          <StatusCard name="Logger" info={ data.logger } />
        </Grid>
      </Grid>
    </PageContainer>
  );
}
