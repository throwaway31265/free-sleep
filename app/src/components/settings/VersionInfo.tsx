import { useVersion } from '@api/version';
import GitHubIcon from '@mui/icons-material/GitHub';
import { Box, Chip, Typography } from '@mui/material';
import Alert from '@mui/material/Alert';
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';

export default function VersionInfo() {
  const { data: version, isLoading, error } = useVersion();
  const [remoteCommit, setRemoteCommit] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      if (!version?.branch) return;
      setChecking(true);
      setCheckError(null);
      setRemoteCommit(null);
      try {
        const res = await fetch(
          `https://api.github.com/repos/throwaway31265/free-sleep/commits/${version.branch}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Trim to 8 chars to match server's stored format
        const sha: string | undefined = data?.sha;
        if (sha) setRemoteCommit(sha.substring(0, 8));
      } catch (e: any) {
        // Network restrictions or rate limits shouldn't break the page
        setCheckError(e?.message || 'Unable to check for updates');
      } finally {
        setChecking(false);
      }
    };
    run();
    return () => controller.abort();
  }, [version?.branch]);

  const isOutOfDate = useMemo(() => {
    if (!version?.commitHash || !remoteCommit) return false;
    return version.commitHash !== remoteCommit;
  }, [version?.commitHash, remoteCommit]);

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
      {isOutOfDate && (
        <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Update available
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Your device is running commit {version.commitHash} but the latest on
            <b> {version.branch}</b> is {remoteCommit}. To update, run the
            installer on your Free Sleep box:
          </Typography>
          <Box component="pre" sx={{ p: 1, bgcolor: 'background.default', borderRadius: 1, overflow: 'auto' }}>
            {`# Main branch:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/throwaway31265/free-sleep/main/scripts/install.sh)"

# Beta branch (not recommended):
BRANCH=beta /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/throwaway31265/free-sleep/beta/scripts/install.sh)"`}
          </Box>
        </Alert>
      )}
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

        {!isOutOfDate && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            {checking
              ? 'Checking for updates...'
              : checkError
                ? 'Unable to check for updates'
                : 'You are up to date'}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
