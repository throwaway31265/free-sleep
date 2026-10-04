import moment from 'moment-timezone';
import { useServerStatus } from '@api/serverStatus.ts';
import {
  Box,
  CircularProgress,
  Typography,
} from '@mui/material';

import PageContainer from '../PageContainer.tsx';
import PageHeader from '@components/PageHeader.tsx';
import StatusRow from './StatusRow.tsx';
import { ServerStatusKey, StatusInfo } from '@api/serverStatusSchema.ts';

export default function StatusPage() {
  const { data, isLoading, dataUpdatedAt } = useServerStatus(5_000);
  const updatedAt = moment(dataUpdatedAt);
  const formatted = updatedAt.format('YYYY-MM-DD HH:mm:ss z');
  return (
    <PageContainer
      sx={ {
        width: '100%',
        maxWidth: 760,
        mx: 'auto',
      } }
    >
      <Box>
        <PageHeader title="Server Status"/>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={ { display: 'block', mt: 1, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' } }
        >
          Updated at: { formatted }
        </Typography>
      </Box>
      { isLoading && <CircularProgress /> }

      {
        data && (
          <Box
            component="ul"
            aria-label="Service status"
            sx={ { listStyle: 'none', m: 0, p: 0, borderTop: '1px solid', borderColor: 'divider' } }
          >
            {
              // @ts-expect-error
              Object.keys(data).map((job: ServerStatusKey) => (
                <StatusRow
                  key={ job }
                  job={ job }
                  statusInfo={ data[job] as StatusInfo }
                />
              ))
            }
          </Box>
        )

      }

    </PageContainer>
  );
}
