import moment from 'moment-timezone';
import { useServerStatus } from '@api/serverStatus.ts';
import {
  CircularProgress,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';

import PageContainer from '../PageContainer.tsx';
import PageHeader from '@components/PageHeader.tsx';
import StatusCard from './StatusCard.tsx';
import { ServerStatusKey, StatusInfo } from '@api/serverStatusSchema.ts';

export default function StatusPage() {
  const { data, isLoading, dataUpdatedAt } = useServerStatus(5_000);
  const updatedAt = moment(dataUpdatedAt);
  const formatted = updatedAt.format('YYYY-MM-DD HH:mm:ss z');
  return (
    <PageContainer
      sx={ {
        width: '100%',
        maxWidth: { xs: '100%', sm: '800px' },
        mx: 'auto',
      } }
    >
      <PageHeader title="Server Status"/>
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
      { isLoading && <CircularProgress /> }

      {
        data && (
          <Grid container spacing={ 2.5 } sx={ { mt: 1 } }>
            {
              // @ts-expect-error
              Object.keys(data).map((job: ServerStatusKey) => (
                <StatusCard
                  key={ job }
                  job={ job }
                  statusInfo={ data[job] as StatusInfo }
                />
              ))
            }
          </Grid>
        )

      }

    </PageContainer>
  );
}
