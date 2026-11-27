import moment from 'moment-timezone';
import { Box, Typography } from '@mui/material';
import { Decision } from '@api/autopilot.ts';
import { describeDecision } from './describeDecision.ts';

type AutopilotDecisionListProps = {
  decisions: Decision[];
  displayCelsius: boolean;
};

// Newest-first list of autopilot decisions; writes are highlighted
export default function AutopilotDecisionList({ decisions, displayCelsius }: AutopilotDecisionListProps) {
  if (decisions.length === 0) {
    return <Typography variant="body2" sx={ { color: 'text.secondary' } }>No decisions yet.</Typography>;
  }
  return (
    <Box component="ol" sx={ { listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.25 } }>
      { decisions.slice().reverse().map(decision => (
        <Box component="li" key={ `${decision.at}-${decision.kind}` } sx={ { display: 'flex', gap: 1.5, minWidth: 0 } }>
          <Typography
            variant="caption"
            sx={ { color: decision.wrote ? 'success.main' : 'text.secondary', fontVariantNumeric: 'tabular-nums', flexShrink: 0, pt: 0.25 } }
          >
            { moment(decision.at).format('HH:mm') }
          </Typography>
          <Typography variant="body2" sx={ { fontSize: 12.5, lineHeight: 1.55, color: decision.wrote ? 'text.primary' : 'text.secondary' } }>
            { describeDecision(decision, displayCelsius) }
          </Typography>
        </Box>
      )) }
    </Box>
  );
}
