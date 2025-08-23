import ClearIcon from '@mui/icons-material/Clear';
import DescriptionIcon from '@mui/icons-material/Description';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import RefreshIcon from '@mui/icons-material/Refresh';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { createFileRoute } from '@tanstack/react-router';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import Header from '@/components/data/Header.tsx';
import PageContainer from '@/components/shared/PageContainer.tsx';
import SectionCard from '@/components/shared/SectionCard.tsx';

export const Route = createFileRoute('/data/logs')({
  component: LogsPage,
});

function LogsPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const isUserAtBottom = useRef(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const theme = useTheme();

  // Fetch available log files
  useEffect(() => {
    const fetchLogFiles = async () => {
      setIsLoading(true);
      setConnectionError(null);
      try {
        const response = await axios.get<{ logs: string[] }>(`/api/logs`);
        const logs = response.data?.logs;

        if (Array.isArray(logs) && logs.length > 0) {
          setLogFiles(logs);
          setSelectedLog(logs[0]); // Default to the latest log file
        } else {
          setLogFiles([]);
          setConnectionError('No log files available');
        }
      } catch (error) {
        console.error('Error fetching log files:', error);
        setConnectionError('Failed to fetch log files');
        setLogFiles([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogFiles();
  }, []);

  // Subscribe to log updates for the selected file
  useEffect(() => {
    if (!selectedLog) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setIsConnected(false);
    setConnectionError(null);

    const eventSource = new EventSource(`/api/logs/${selectedLog}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setConnectionError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const logData = JSON.parse(event.data);
        if (logData && logData.message) {
          setLogs((prevLogs) => [...prevLogs.slice(-999), logData.message]); // Keep last 1000 logs
        }
      } catch (parseError) {
        console.error('Error parsing log data:', parseError);
        // Still add the raw message if JSON parsing fails
        setLogs((prevLogs) => [...prevLogs.slice(-999), event.data]);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setConnectionError('Lost connection to log stream');
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [selectedLog]); // Re-run when log file changes

  // Track if user is at the bottom
  const handleScroll = () => {
    if (!logsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    isUserAtBottom.current = scrollHeight - scrollTop <= clientHeight + 50; // 50px buffer
  };

  // Auto-scroll only if user is at the bottom
  useEffect(() => {
    if (isUserAtBottom.current) {
      logsEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [logs]);

  // Helper functions
  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleRefreshConnection = () => {
    if (selectedLog) {
      // This will trigger the useEffect and reconnect
      const currentLog = selectedLog;
      setSelectedLog('');
      setTimeout(() => setSelectedLog(currentLog), 100);
    }
  };

  const handleRefreshLogFiles = async () => {
    setIsLoading(true);
    setConnectionError(null);
    try {
      const response = await axios.get<{ logs: string[] }>(`/api/logs`);
      const logs = response.data?.logs;

      if (Array.isArray(logs) && logs.length > 0) {
        setLogFiles(logs);
        // If no log is currently selected, select the first one
        if (!selectedLog) {
          setSelectedLog(logs[0]);
        }
      } else {
        setLogFiles([]);
        setConnectionError('No log files available');
      }
    } catch (error) {
      console.error('Error fetching log files:', error);
      setConnectionError('Failed to fetch log files');
      setLogFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileName = (fileName: string) => {
    // Remove file extension and format nicely
    return fileName.replace(/\.(log|txt)$/, '').replace(/_/g, ' ');
  };

  const getLogFileIcon = (fileName: string) => {
    if (fileName.includes('error')) return '🔴';
    if (fileName.includes('access')) return '🌐';
    if (fileName.includes('debug')) return '🐛';
    return '📄';
  };

  return (
    <PageContainer sx={{ mb: 4, mt: 2 }}>
      <Header title="System Logs" icon={<TextSnippetIcon />} />

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: {
            xs: '1fr',
            md: '300px 1fr',
            lg: '320px 1fr',
            xl: '350px 1fr',
          },
          alignItems: 'start',
          height: 'fit-content',
          width: '100%',
        }}
      >
        {/* Log File Selector Section */}
        <SectionCard
          title="Log File Selection"
          subheader="Choose which log file to monitor in real-time"
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Select Log File</InputLabel>
              <Select
                value={selectedLog}
                label="Select Log File"
                onChange={(e) => {
                  setLogs([]);
                  setSelectedLog(e.target.value);
                }}
                disabled={isLoading || logFiles.length === 0}
                renderValue={(value) => (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{getLogFileIcon(value)}</span>
                    <Typography>{formatFileName(value)}</Typography>
                  </Box>
                )}
              >
                {logFiles.length > 0 ? (
                  logFiles.map((file) => (
                    <MenuItem key={file} value={file}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          width: '100%',
                        }}
                      >
                        <span>{getLogFileIcon(file)}</span>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {formatFileName(file)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {file}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>
                    <Typography variant="body2" color="text.secondary">
                      {isLoading
                        ? 'Loading log files...'
                        : 'No log files available'}
                    </Typography>
                  </MenuItem>
                )}
              </Select>
            </FormControl>

            {/* Connection Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FiberManualRecordIcon
                sx={{
                  fontSize: 12,
                  color: isConnected
                    ? 'success.main'
                    : connectionError
                      ? 'error.main'
                      : 'warning.main',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {isLoading
                  ? 'Loading...'
                  : isConnected
                    ? 'Connected - Live updates'
                    : connectionError
                      ? connectionError
                      : 'Connecting...'}
              </Typography>
            </Box>

            {/* Log Statistics */}
            {logs.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={`${logs.length} lines`}
                  size="small"
                  variant="outlined"
                  icon={<DescriptionIcon />}
                />
                <Chip
                  label="Live"
                  size="small"
                  color={isConnected ? 'success' : 'default'}
                  variant={isConnected ? 'filled' : 'outlined'}
                />
              </Box>
            )}

            {/* Error Display */}
            {connectionError && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: 'error.main',
                  color: 'error.contrastText',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Typography variant="body2">{connectionError}</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleRefreshLogFiles}
                  disabled={isLoading}
                  sx={{
                    ml: 'auto',
                    color: 'inherit',
                    borderColor: 'currentColor',
                  }}
                >
                  Retry
                </Button>
              </Box>
            )}

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Tooltip title="Refresh log files list">
                <IconButton
                  onClick={handleRefreshLogFiles}
                  disabled={isLoading}
                  size="small"
                  color="primary"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Clear current logs from display">
                <IconButton
                  onClick={handleClearLogs}
                  disabled={logs.length === 0}
                  size="small"
                  color="primary"
                >
                  <ClearIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh connection to current log">
                <IconButton
                  onClick={handleRefreshConnection}
                  disabled={!selectedLog}
                  size="small"
                  color="primary"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </SectionCard>

        {/* Log Display Section */}
        <SectionCard
          title={
            selectedLog
              ? `${formatFileName(selectedLog)} - Live Stream`
              : 'Log Output'
          }
          subheader={
            selectedLog
              ? 'Real-time log monitoring with auto-scroll'
              : 'Select a log file to begin monitoring'
          }
        >
          {selectedLog ? (
            <Box
              ref={logsContainerRef}
              onScroll={handleScroll}
              sx={{
                height: `${Math.min(window.innerHeight - 400, 600)}px`,
                overflowY: 'auto',
                overflowX: 'auto',
                fontFamily:
                  '"Fira Code", "JetBrains Mono", "Monaco", "Cascadia Code", monospace',
                fontSize: '13px',
                lineHeight: 1.4,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                p: 2,
                bgcolor: 'rgba(0, 0, 0, 0.8)',
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                '&::-webkit-scrollbar': {
                  width: '12px',
                  height: '12px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(255, 255, 255, 0.3)',
                  borderRadius: '6px',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.5)',
                  },
                },
                '&::-webkit-scrollbar-corner': {
                  background: 'transparent',
                },
              }}
            >
              {logs.length > 0 ? (
                <>
                  <Typography
                    component="pre"
                    sx={{
                      margin: 0,
                      color: theme.palette.grey[100],
                      fontSize: 'inherit',
                      lineHeight: 'inherit',
                      fontFamily: 'inherit',
                    }}
                  >
                    {logs.join('\n')}
                  </Typography>
                  <div ref={logsEndRef} />
                </>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {isConnected
                      ? 'Waiting for log entries...'
                      : 'Connecting to log stream...'}
                  </Typography>
                  {connectionError && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleRefreshConnection}
                      startIcon={<RefreshIcon />}
                    >
                      Retry Connection
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '300px',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <DescriptionIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
              <Typography
                variant="body1"
                color="text.secondary"
                textAlign="center"
              >
                Select a log file from the left panel to begin monitoring
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
              >
                Real-time updates will appear here automatically
              </Typography>
            </Box>
          )}
        </SectionCard>
      </Box>
    </PageContainer>
  );
}
