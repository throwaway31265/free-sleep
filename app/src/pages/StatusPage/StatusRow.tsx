import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import moment from 'moment-timezone';
import { ServerStatusKey, StatusInfo } from '@api/serverStatusSchema.ts';
import {
  Box,
  Button,
  Typography,
} from '@mui/material';

import StatusChip from './StatusChip.tsx';
import { postJobs, JobSchema, Jobs } from '@api/jobs.ts';
import { useState } from 'react';


type StatusRowProps = {
  statusInfo: StatusInfo;
  job: ServerStatusKey,
}
export default function StatusRow({ job, statusInfo }: StatusRowProps) {
  const timestamp = statusInfo.timestamp && moment(statusInfo.timestamp).format('YYYY-MM-DD HH:mm:ss z');
  let isRunnable = false;
  // @ts-expect-error
  if (JobSchema.options.includes(job)) {
    isRunnable = true;
  }
  const [disabled, setDisabled] = useState(false);
  const startJob = () => {
    setDisabled(true);
    postJobs([job] as Jobs)
      .catch(error => {
        console.error(error);
      });
    setTimeout(() => setDisabled(false), 30_000);
  };

  return (
    <Box
      component="li"
      sx={ {
        py: 2.5, borderBottom: '1px solid', borderColor: 'divider',
        display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0,
      } }
    >
      <Box
        sx={ {
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'start', gap: 1.5,
        } }
      >
        <Typography component="h2" variant="body1" fontWeight={ 600 } sx={ { overflowWrap: 'anywhere' } }>
          { statusInfo.name }
        </Typography>
        <StatusChip info={ statusInfo }/>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={ { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }>
        { statusInfo.description }
      </Typography>
      { statusInfo.message && (
        <Typography
          variant="body2"
          color="error"
          sx={ { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }
        >
          Error: { statusInfo.message }
        </Typography>
      ) }
      { (timestamp || isRunnable) && (
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mt: 0.5 } }>
          { timestamp && (
            <Typography variant="caption" color="text.secondary" sx={ { fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' } }>
              { timestamp }
            </Typography>
          ) }
          { isRunnable && (
            <Button
              onClick={ startJob }
              variant="outlined"
              size="small"
              disabled={ disabled || statusInfo.status === 'started' }
              startIcon={ <PlayArrowIcon/> }
              sx={ { ml: 'auto', px: 1.5 } }
            >
              Run
            </Button>
          ) }
        </Box>
      ) }
    </Box>
  );
}
