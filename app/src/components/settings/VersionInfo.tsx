import { useVersion } from '@api/version';
import GitHubIcon from '@mui/icons-material/GitHub';
import { Box, Chip, Typography } from '@mui/material';
import { format } from 'date-fns';

export default function VersionInfo() {
  const { data: version, isLoading, error } = useVersion();

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Loading version info...
        </Typography>
      </Box>
    );
  }

  if (error || !version) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Version info unavailable
        </Typography>
      </Box>
    );
  }

  const formatBuildDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch {
      return dateString;
    }
  };

  const getBranchColor = (branch: string) => {
    switch (branch) {
      case 'main':
        return 'success';
      case 'beta':
        return 'warning';
      default:
        return 'default';
    }
  };

  const truncateTitle = (title: string | undefined | null, maxLength = 50) => {
    if (!title || typeof title !== 'string')
      return 'No commit message available';
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  return (
    <Box sx={{ textAlign: 'center', py: 2 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 1,
          mb: 2,
        }}
      >
        <GitHubIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
        <Typography variant="h6" color="text.primary">
          Version Information
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Chip
            label={`Branch: ${version.branch || 'unknown'}`}
            color={getBranchColor(version.branch || 'unknown') as any}
            variant="outlined"
            size="small"
          />
          <Chip
            label={`Commit: ${version.commitHash || 'unknown'}`}
            variant="outlined"
            size="small"
          />
        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, px: 2 }}
        >
          {truncateTitle(version.commitTitle)}
        </Typography>

        <Typography variant="caption" color="text.secondary">
          Built:{' '}
          {formatBuildDate(version.buildDate || new Date().toISOString())}
        </Typography>
      </Box>
    </Box>
  );
}
